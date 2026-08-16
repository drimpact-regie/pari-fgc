import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompletedSets, getEventTopSeedEntrantIds, getSetResult, StartggApiError } from "@/lib/startgg";
import { getTwitchUserByLogin, sendChatMessage } from "@/lib/twitch";
import { detectNewLateBracketResults, formatMatchResultMessage, resolveSetBets } from "@/lib/matchResults";

/**
 * Annonce dans le chat Twitch du tournoi les résultats de phases finales
 * tardives (Top N tardif, grande finale) pas encore annoncés, en réutilisant
 * le même point de détection que la résolution des paris ci-dessus plutôt
 * que d'interroger start.gg une seconde fois séparément — best-effort, ne
 * doit jamais faire échouer la synchronisation globale.
 */
async function announceLateBracketResults(tournamentId: string, eventSlug: string, twitchChannel: string) {
  try {
    const [completedSets, topSeedEntrantIds] = await Promise.all([
      getCompletedSets(eventSlug),
      getEventTopSeedEntrantIds(eventSlug).catch(() => new Set<string>()),
    ]);
    const results = await detectNewLateBracketResults(
      { id: tournamentId, eventSlug },
      completedSets,
      topSeedEntrantIds,
    );
    if (results.length === 0) return;

    const broadcaster = await getTwitchUserByLogin(twitchChannel);
    if (!broadcaster) return;

    await sendChatMessage({ broadcasterId: broadcaster.id, message: formatMatchResultMessage(results) });
  } catch {
    // best-effort
  }
}

/**
 * Résout les paris en attente : pour chaque match parié qui est terminé
 * côté start.gg, marque les paris WON/LOST et attribue les points. Annonce
 * aussi dans le chat Twitch les résultats de phases finales tardives pas
 * encore annoncés (voir lib/matchResults.ts).
 *
 * Accessible soit par un utilisateur admin connecté, soit via un secret
 * partagé (header x-admin-secret), pour permettre un déclenchement externe
 * (cron / webhook) sans session navigateur.
 */
export async function POST(request: Request) {
  const session = await auth();
  const secretHeader = request.headers.get("x-admin-secret");
  const isAuthorized =
    session?.user?.isAdmin === true ||
    (process.env.ADMIN_SYNC_SECRET &&
      secretHeader === process.env.ADMIN_SYNC_SECRET);

  if (!isAuthorized) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const pendingSetIds = await prisma.bet.findMany({
    where: { status: "PENDING" },
    distinct: ["setId"],
    select: { setId: true },
  });

  let resolvedSets = 0;
  let resolvedBets = 0;
  const errors: string[] = [];

  for (const { setId } of pendingSetIds) {
    let set;
    try {
      set = await getSetResult(setId);
    } catch (err) {
      errors.push(
        err instanceof StartggApiError
          ? `${setId}: ${err.message}`
          : `${setId}: erreur inconnue`,
      );
      continue;
    }

    if (!set) continue;

    const resolvedCount = await resolveSetBets(set);
    if (resolvedCount > 0) {
      resolvedSets += 1;
      resolvedBets += resolvedCount;
    }
  }

  const tournamentsWithChat = await prisma.tournament.findMany({
    where: { twitchChannel: { not: null } },
  });
  await Promise.all(
    tournamentsWithChat.map((t) =>
      announceLateBracketResults(t.id, t.eventSlug, t.twitchChannel!),
    ),
  );

  return NextResponse.json({ resolvedSets, resolvedBets, errors });
}
