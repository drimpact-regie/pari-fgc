import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ensureUserByTwitchId } from "@/lib/users";
import { sendChatMessage, verifyWebhookSignature } from "@/lib/twitch";
import { SITE_URL } from "@/config/tournament";
import {
  getCompletedSets,
  getEventInfo,
  getSetResult,
  getStandings,
  getUpcomingSets,
  isMvcLocked,
  SET_STATE,
  type StartggEntrant,
  type StartggSet,
} from "@/lib/startgg";
import {
  isHelpCommand,
  isMvcCommand,
  isResetCommand,
  isTop8Command,
  matchCharacterName,
  parseMvcCommand,
  parseResetCommand,
  parseTop8Target,
} from "@/lib/chatBets";

interface ChatMessageEvent {
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  chatter_user_id: string;
  chatter_user_login: string;
  chatter_user_name: string;
  message: { text: string };
}

/** Envoie une réponse dans le chat, sans jamais faire échouer le webhook. */
async function reply(broadcasterId: string, message: string) {
  try {
    await sendChatMessage({ broadcasterId, message });
  } catch {
    // best-effort : un message de confirmation qui échoue à partir ne doit
    // pas empêcher le pari lui-même d'avoir été enregistré.
  }
}

function accountLinkHint(): string {
  return SITE_URL ? ` : ${SITE_URL}/account` : " (page Compte du site)";
}

/**
 * Nomenclature unifiée sous "!bet" (avec "!top8" gardé en alias historique) :
 * envoyée sur "!bet", "!bet aide" ou "!bet help".
 */
const HELP_TEXT =
  "Paris chat : !bet <joueur> (vainqueur d'un match) | " +
  "!bet mvc <personnage> <0-8> (MVC) | !bet reset oui|non (reset de bracket) | " +
  "!bet top8 <j1, j2, ..., j8> (pronostic top 8, alias : !top8). " +
  "Compte Twitch lié requis pour mvc/reset" +
  (SITE_URL ? ` : ${SITE_URL}/account` : "") +
  ".";

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
async function ensureChatBettor(chatter: { id: string; login: string; displayName: string }) {
  return ensureUserByTwitchId(chatter.id, chatter.displayName || chatter.login);
}

function openEntrants(set: StartggSet): StartggEntrant[] {
  return set.slots
    .map((slot) => slot.entrant)
    .filter((e): e is StartggEntrant => e !== null);
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

/** !bet top8 (alias !top8) — pari "Le Pari du Parry", répond dans le chat comme mvc/reset. */
async function handleTop8Command(
  target: string,
  tournament: { id: string; eventSlug: string; name: string; topEightLocked: boolean },
  chatter: { id: string; login: string; displayName: string },
  broadcasterId: string,
) {
  if (tournament.topEightLocked) {
    await reply(broadcasterId, `@${chatter.displayName} le pronostic Top 8 est fermé pour ${tournament.name}.`);
    return;
  }

  const names = target
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (names.length === 0) {
    await reply(broadcasterId, `@${chatter.displayName} syntaxe : !bet top8 <j1>, <j2>, ..., <j8>`);
    return;
  }

  let standings;
  try {
    standings = await getStandings(tournament.eventSlug);
  } catch {
    await reply(
      broadcasterId,
      `@${chatter.displayName} impossible de récupérer les joueurs de ${tournament.name}, réessaie plus tard.`,
    );
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
  if (picks.length === 0) {
    await reply(
      broadcasterId,
      `@${chatter.displayName} aucun des noms donnés ne correspond à un joueur de ${tournament.name}.`,
    );
    return;
  }

  const bettor = await ensureChatBettor(chatter);

  await prisma.topEightPick.upsert({
    where: { userId_eventSlug: { userId: bettor.id, eventSlug: tournament.eventSlug } },
    update: { picks },
    create: { userId: bettor.id, eventSlug: tournament.eventSlug, picks },
  });

  await reply(
    broadcasterId,
    `@${chatter.displayName} a pronostiqué son Top 8 pour ${tournament.name} : ${picks
      .map((p) => p.entrantName)
      .join(", ")} !`,
  );
}

/**
 * !bet mvc <personnage> <0-8> — pari "Le Pari du Parry", nécessite un
 * compte lié à Twitch (contrairement au pari classique et au top 8, qui
 * créent un compte allégé à la volée) : les points de ce pari doivent
 * revenir à un vrai compte du site, pas à une identité jetable.
 */
async function handleMvcChatCommand(
  target: string,
  tournament: { eventSlug: string; name: string; topEightLocked: boolean },
  chatter: { id: string; login: string; displayName: string },
  broadcasterId: string,
) {
  const parsed = parseMvcCommand(target);
  if (!parsed) {
    await reply(broadcasterId, `@${chatter.displayName} syntaxe : !bet mvc <personnage> <0-8>`);
    return;
  }

  const bettor = await prisma.user.findUnique({ where: { twitchId: chatter.id } });
  if (!bettor) {
    await reply(
      broadcasterId,
      `@${chatter.displayName} lie d'abord ton compte Twitch sur le site pour parier en chat${accountLinkHint()}.`,
    );
    return;
  }

  let videogameName: string | null = null;
  try {
    const eventInfo = await getEventInfo(tournament.eventSlug);
    videogameName = eventInfo?.videogameName ?? null;
  } catch {
    videogameName = null;
  }
  if (!videogameName) {
    await reply(
      broadcasterId,
      `@${chatter.displayName} paris MVC indisponibles pour ${tournament.name} (jeu inconnu).`,
    );
    return;
  }

  const characters = await prisma.character.findMany({ where: { game: videogameName } });
  const { match, suggestions } = matchCharacterName(parsed.characterQuery, characters);
  if (!match) {
    const hint = suggestions.length ? ` Tu voulais peut-être : ${suggestions.join(", ")} ?` : "";
    await reply(
      broadcasterId,
      `@${chatter.displayName} personnage "${parsed.characterQuery}" introuvable.${hint}`,
    );
    return;
  }

  let locked = tournament.topEightLocked;
  try {
    const [upcoming, completed] = await Promise.all([
      getUpcomingSets(tournament.eventSlug),
      getCompletedSets(tournament.eventSlug),
    ]);
    locked = isMvcLocked([...upcoming, ...completed], tournament.topEightLocked);
  } catch {
    locked = tournament.topEightLocked;
  }
  if (locked) {
    await reply(broadcasterId, `@${chatter.displayName} les paris MVC sont fermés pour ${tournament.name}.`);
    return;
  }

  await prisma.mvcBet.upsert({
    where: { userId_eventSlug: { userId: bettor.id, eventSlug: tournament.eventSlug } },
    update: { characterId: match.id, predictedCount: parsed.count },
    create: {
      userId: bettor.id,
      eventSlug: tournament.eventSlug,
      characterId: match.id,
      predictedCount: parsed.count,
    },
  });

  await reply(
    broadcasterId,
    `@${chatter.displayName} a parié qu'il y aura ${parsed.count} ${match.name} dans le top 8 de ${tournament.name} !`,
  );
}

/** !bet reset oui|non|yes|no — même règle de compte lié que le MVC. */
async function handleResetChatCommand(
  target: string,
  tournament: { eventSlug: string; name: string; bracketResetLocked: boolean },
  chatter: { id: string; login: string; displayName: string },
  broadcasterId: string,
) {
  const predictedYes = parseResetCommand(target);
  if (predictedYes === null) {
    await reply(broadcasterId, `@${chatter.displayName} syntaxe : !bet reset oui|non`);
    return;
  }

  const bettor = await prisma.user.findUnique({ where: { twitchId: chatter.id } });
  if (!bettor) {
    await reply(
      broadcasterId,
      `@${chatter.displayName} lie d'abord ton compte Twitch sur le site pour parier en chat${accountLinkHint()}.`,
    );
    return;
  }

  if (tournament.bracketResetLocked) {
    await reply(
      broadcasterId,
      `@${chatter.displayName} le pari reset de bracket est fermé pour ${tournament.name}.`,
    );
    return;
  }

  await prisma.bracketResetBet.upsert({
    where: { userId_eventSlug: { userId: bettor.id, eventSlug: tournament.eventSlug } },
    update: { predictedYes },
    create: { userId: bettor.id, eventSlug: tournament.eventSlug, predictedYes },
  });

  await reply(
    broadcasterId,
    `@${chatter.displayName} a parié ${predictedYes ? "Oui" : "Non"} sur le reset de bracket de ${tournament.name} !`,
  );
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
  const broadcasterId = event.broadcaster_user_id;

  const betTarget = extractCommandTarget(text, BET_COMMANDS);
  const top8Target = betTarget === null ? extractCommandTarget(text, TOP8_COMMANDS) : null;

  if (betTarget === null && top8Target === null) {
    return NextResponse.json({ ok: true });
  }

  // "!bet" seul, "!bet aide" ou "!bet help" : liste des commandes, sans
  // avoir besoin d'un tournoi en cours.
  if (betTarget !== null && isHelpCommand(betTarget)) {
    await reply(broadcasterId, HELP_TEXT);
    return NextResponse.json({ ok: true });
  }

  // "Le Pari du Parry" (top 8, mvc, reset) répond explicitement dans le chat
  // pour chaque cas ; le pari classique ("!bet <joueur>") reste silencieux.
  const isTop8Invocation = top8Target !== null || (betTarget !== null && isTop8Command(betTarget));
  const isParrySubCommand =
    isTop8Invocation ||
    (betTarget !== null && (isMvcCommand(betTarget) || isResetCommand(betTarget)));

  const tournament = await prisma.tournament.findFirst({
    where: { twitchChannel: event.broadcaster_user_login },
  });
  if (!tournament) {
    if (isParrySubCommand) {
      await reply(broadcasterId, "Pas de paris chat en cours actuellement sur cette chaîne.");
    }
    return NextResponse.json({ ok: true });
  }

  const chatter = {
    id: event.chatter_user_id,
    login: event.chatter_user_login,
    displayName: event.chatter_user_name,
  };

  if (betTarget !== null && isMvcCommand(betTarget)) {
    await handleMvcChatCommand(betTarget, tournament, chatter, broadcasterId);
  } else if (betTarget !== null && isResetCommand(betTarget)) {
    await handleResetChatCommand(betTarget, tournament, chatter, broadcasterId);
  } else if (betTarget !== null && isTop8Command(betTarget)) {
    await handleTop8Command(parseTop8Target(betTarget) ?? "", tournament, chatter, broadcasterId);
  } else if (betTarget !== null) {
    await handleBetCommand(betTarget, tournament, chatter);
  } else if (top8Target !== null) {
    await handleTop8Command(top8Target, tournament, chatter, broadcasterId);
  }

  return NextResponse.json({ ok: true });
}
