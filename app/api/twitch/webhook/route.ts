import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/twitch";
import { getSetResult, getStandings, getUpcomingSets, SET_STATE, type StartggSet } from "@/lib/startgg";

interface ChatMessageEvent {
  broadcaster_user_login: string;
  chatter_user_id: string;
  chatter_user_login: string;
  chatter_user_name: string;
  message: { text: string };
}

const BET_COMMANDS = ["!bet", "!pari"];
const TOP8_COMMANDS = ["!top8", "!top 8"];

function extractCommandTarget(text: string, commands: string[]): string | null {
  const trimmed = text.trim();
  for (const command of commands) {
    if (trimmed.toLowerCase().startsWith(command)) {
      return trimmed.slice(command.length).trim();
    }
  }
  return null;
}

/** Rapproche un nom tapé en chat (souvent imparfait) du bon entrant. */
function matchEntrant(
  target: string,
  entrants: { id: string; name: string }[],
): { id: string; name: string } | null {
  const normalized = target.trim().toLowerCase();
  if (!normalized) return null;

  const exact = entrants.find((e) => e.name.toLowerCase() === normalized);
  if (exact) return exact;

  const startsWith = entrants.find((e) => e.name.toLowerCase().startsWith(normalized));
  if (startsWith) return startsWith;

  const contains = entrants.filter((e) => e.name.toLowerCase().includes(normalized));
  return contains.length === 1 ? contains[0] : null;
}

/** Crée (ou récupère) le compte parieur associé à ce compte Twitch. */
async function ensureChatBettor(chatter: {
  id: string;
  login: string;
  displayName: string;
}) {
  const existing = await prisma.user.findUnique({ where: { twitchId: chatter.id } });
  if (existing) return existing;

  const baseUsername = chatter.displayName || chatter.login;
  try {
    return await prisma.user.create({
      data: { username: baseUsername, twitchId: chatter.id },
    });
  } catch (err: unknown) {
    const isUniqueViolation =
      err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002";
    if (!isUniqueViolation) throw err;
    // Le pseudo est déjà pris par un compte site distinct : on suffixe.
    return prisma.user.create({
      data: {
        username: `${baseUsername}-tw${chatter.id.slice(-4)}`,
        twitchId: chatter.id,
      },
    });
  }
}

function openEntrants(set: StartggSet): { id: string; name: string }[] {
  return set.slots
    .map((slot) => slot.entrant)
    .filter((e): e is { id: string; name: string } => e !== null);
}

async function placeChatBet(
  set: StartggSet,
  chosenEntrant: { id: string; name: string },
  eventSlug: string,
  chatter: { id: string; login: string; displayName: string },
) {
  const bettor = await ensureChatBettor(chatter);

  await prisma.bet
    .create({
      data: {
        userId: bettor.id,
        setId: set.id,
        eventSlug,
        roundText: set.fullRoundText ?? "",
        predictedEntrantId: chosenEntrant.id,
        predictedEntrantName: chosenEntrant.name,
      },
    })
    .catch(() => undefined); // déjà parié sur ce match : on ignore silencieusement
}

/**
 * !bet cherche par défaut le joueur parmi TOUS les matchs actuellement
 * ouverts (pas commencés) du tournoi — on peut parier sur plusieurs matchs
 * en parallèle depuis le chat, pas juste celui affiché à l'écran. Le match
 * marqué "actif" par un admin (le cas échéant) est prioritaire pour
 * désambiguïser si le même nom correspond à plusieurs matchs ouverts.
 */
async function handleBetCommand(
  target: string,
  tournament: { eventSlug: string; activeChatSetId: string | null },
  chatter: { id: string; login: string; displayName: string },
) {
  if (tournament.activeChatSetId) {
    let activeSet: StartggSet | null = null;
    try {
      activeSet = await getSetResult(tournament.activeChatSetId);
    } catch {
      activeSet = null;
    }
    if (activeSet && activeSet.state === SET_STATE.NOT_STARTED) {
      const chosen = matchEntrant(target, openEntrants(activeSet));
      if (chosen) {
        await placeChatBet(activeSet, chosen, tournament.eventSlug, chatter);
        return;
      }
    }
  }

  let allSets: StartggSet[];
  try {
    allSets = await getUpcomingSets(tournament.eventSlug);
  } catch {
    return;
  }

  const candidates = allSets
    .filter((set) => set.state === SET_STATE.NOT_STARTED)
    .map((set) => {
      const chosen = matchEntrant(target, openEntrants(set));
      return chosen ? { set, chosen } : null;
    })
    .filter((c): c is { set: StartggSet; chosen: { id: string; name: string } } => c !== null);

  // Le nom doit désigner un joueur dans exactement un match ouvert, sinon
  // c'est ambigu (ou introuvable) et on ignore silencieusement.
  if (candidates.length !== 1) return;

  await placeChatBet(candidates[0].set, candidates[0].chosen, tournament.eventSlug, chatter);
}

async function handleTop8Command(
  target: string,
  tournament: { id: string; eventSlug: string; topEightLocked: boolean },
  chatter: { id: string; login: string; displayName: string },
) {
  if (tournament.topEightLocked) return;

  const names = target
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (names.length === 0) return;

  let standings;
  try {
    standings = await getStandings(tournament.eventSlug);
  } catch {
    return;
  }

  const entrants = standings
    .filter((s) => s.entrant)
    .map((s) => ({ id: s.entrant!.id, name: s.entrant!.name }));

  const picks: { entrantId: string; entrantName: string }[] = [];
  const seenIds = new Set<string>();
  for (const name of names) {
    const match = matchEntrant(name, entrants);
    if (match && !seenIds.has(match.id)) {
      seenIds.add(match.id);
      picks.push({ entrantId: match.id, entrantName: match.name });
    }
  }
  if (picks.length === 0) return;

  const bettor = await ensureChatBettor(chatter);

  await prisma.topEightPick.upsert({
    where: { userId_eventSlug: { userId: bettor.id, eventSlug: tournament.eventSlug } },
    update: { picks },
    create: { userId: bettor.id, eventSlug: tournament.eventSlug, picks },
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const messageType = request.headers.get("Twitch-Eventsub-Message-Type");
  const messageId = request.headers.get("Twitch-Eventsub-Message-Id") ?? "";
  const timestamp = request.headers.get("Twitch-Eventsub-Message-Timestamp") ?? "";
  const signature = request.headers.get("Twitch-Eventsub-Message-Signature");

  const secret = process.env.TWITCH_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "TWITCH_WEBHOOK_SECRET manquant." }, { status: 500 });
  }

  const valid = verifyWebhookSignature({
    messageId,
    timestamp,
    rawBody,
    signatureHeader: signature,
    secret,
  });
  if (!valid) {
    return NextResponse.json({ error: "Signature invalide." }, { status: 403 });
  }

  const body = JSON.parse(rawBody);

  if (messageType === "webhook_callback_verification") {
    return new NextResponse(body.challenge, { status: 200 });
  }

  if (messageType === "revocation") {
    await prisma.tournament.updateMany({
      where: { twitchSubscriptionId: body.subscription?.id },
      data: { twitchSubscriptionId: null },
    });
    return NextResponse.json({ ok: true });
  }

  if (messageType !== "notification") {
    return NextResponse.json({ ok: true });
  }

  const event = body.event as ChatMessageEvent;
  const text = event.message.text;

  const betTarget = extractCommandTarget(text, BET_COMMANDS);
  const top8Target = betTarget === null ? extractCommandTarget(text, TOP8_COMMANDS) : null;

  if (betTarget === null && top8Target === null) {
    return NextResponse.json({ ok: true });
  }

  const tournament = await prisma.tournament.findFirst({
    where: { twitchChannel: event.broadcaster_user_login },
  });
  if (!tournament) {
    return NextResponse.json({ ok: true });
  }

  const chatter = {
    id: event.chatter_user_id,
    login: event.chatter_user_login,
    displayName: event.chatter_user_name,
  };

  if (betTarget !== null) {
    await handleBetCommand(betTarget, tournament, chatter);
  } else if (top8Target !== null) {
    await handleTop8Command(top8Target, tournament, chatter);
  }

  return NextResponse.json({ ok: true });
}
