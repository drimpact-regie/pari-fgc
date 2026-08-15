import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/twitch";
import { getSetResult, SET_STATE } from "@/lib/startgg";

interface ChatMessageEvent {
  broadcaster_user_login: string;
  chatter_user_id: string;
  chatter_user_login: string;
  chatter_user_name: string;
  message: { text: string };
}

const BET_COMMANDS = ["!bet", "!pari"];

function extractBetTarget(text: string): string | null {
  const trimmed = text.trim();
  for (const command of BET_COMMANDS) {
    if (trimmed.toLowerCase().startsWith(command)) {
      return trimmed.slice(command.length).trim();
    }
  }
  return null;
}

/** Rapproche un nom tapé en chat (souvent imparfait) du bon entrant du set. */
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
  const betTarget = extractBetTarget(event.message.text);
  if (!betTarget) {
    return NextResponse.json({ ok: true });
  }

  const tournament = await prisma.tournament.findFirst({
    where: { twitchChannel: event.broadcaster_user_login },
  });
  if (!tournament?.activeChatSetId) {
    return NextResponse.json({ ok: true });
  }

  let set;
  try {
    set = await getSetResult(tournament.activeChatSetId);
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (!set || set.state !== SET_STATE.NOT_STARTED) {
    return NextResponse.json({ ok: true });
  }

  const entrants = set.slots
    .map((slot) => slot.entrant)
    .filter((e): e is { id: string; name: string } => e !== null);

  const chosenEntrant = matchEntrant(betTarget, entrants);
  if (!chosenEntrant) {
    return NextResponse.json({ ok: true });
  }

  const bettor = await ensureChatBettor({
    id: event.chatter_user_id,
    login: event.chatter_user_login,
    displayName: event.chatter_user_name,
  });

  await prisma.bet
    .create({
      data: {
        userId: bettor.id,
        setId: set.id,
        eventSlug: tournament.eventSlug,
        roundText: set.fullRoundText ?? "",
        predictedEntrantId: chosenEntrant.id,
        predictedEntrantName: chosenEntrant.name,
      },
    })
    .catch(() => undefined); // déjà parié sur ce match : on ignore silencieusement

  return NextResponse.json({ ok: true });
}
