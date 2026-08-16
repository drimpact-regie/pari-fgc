import type { Tournament } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { computeMatchBetPayout } from "@/lib/odds";
import { isNotableMatch, SET_STATE, type StartggSet } from "@/lib/startgg";

/**
 * Résout tous les paris classiques PENDING d'un set terminé (WON/LOST +
 * gain en Ex crédité au solde du parieur, dans la même transaction que la
 * mise à jour du statut). Idempotent : n'agit que sur les paris encore
 * PENDING, donc sans effet si déjà résolu par un autre passage. La mise
 * elle-même a déjà été débitée au moment du pari (voir /api/bets) — ici on
 * ne fait que créditer le gain total (mise × cote) en cas de victoire.
 *
 * Paris légués d'avant l'introduction de la mise/cote (stake/odds encore
 * nuls) : marqués WON/LOST sans paiement, faute de mise réellement
 * collectée à rembourser.
 */
export async function resolveSetBets(set: StartggSet): Promise<number> {
  if (set.state !== SET_STATE.COMPLETED || set.winnerId == null) return 0;

  const winnerId = String(set.winnerId);
  const bets = await prisma.bet.findMany({ where: { setId: set.id, status: "PENDING" } });

  for (const bet of bets) {
    const won = bet.predictedEntrantId === winnerId;
    const payout =
      bet.stake != null && bet.odds != null
        ? computeMatchBetPayout({ won, stake: bet.stake, odds: bet.odds })
        : 0;

    await prisma.$transaction([
      prisma.bet.update({
        where: { id: bet.id },
        data: { status: won ? "WON" : "LOST", pointsAwarded: payout, resolvedAt: new Date() },
      }),
      ...(payout > 0
        ? [
            prisma.user.update({
              where: { id: bet.userId },
              data: { exBalance: { increment: payout } },
            }),
          ]
        : []),
    ]);
  }

  return bets.length;
}

export interface CompletedMatchAnnouncement {
  winnerName: string;
  loserName: string;
  winnerScore: number | null;
  loserScore: number | null;
}

/**
 * Détecte, parmi des sets terminés déjà récupérés côté start.gg, ceux qui
 * comptent comme "notables" (phases finales tardives, Top N tardif/grande
 * finale, OU impliquant un des meilleurs seeds du tournoi même en phase de
 * poules — voir isNotableMatch) pas encore annoncés dans le chat pour ce
 * tournoi. Pour chacun : résout ses paris classiques en attente
 * (best-effort, sans effet si déjà résolus ailleurs) puis le marque comme
 * annoncé pour ne pas le republier au prochain passage. Renvoie les
 * résultats fraîchement détectés, prêts à être formatés pour le chat.
 *
 * Prend `completedSets` en paramètre (plutôt que d'appeler start.gg
 * elle-même) pour rester testable sans réseau — l'appelant se charge de
 * l'appel getCompletedSets() et de sa gestion d'erreur. `topSeedEntrantIds`
 * (best-effort, peut être un Set vide si l'appelant n'a pas pu le
 * récupérer) sert au même usage.
 */
export async function detectNewLateBracketResults(
  tournament: Pick<Tournament, "id" | "eventSlug">,
  completedSets: StartggSet[],
  topSeedEntrantIds: ReadonlySet<string> = new Set(),
): Promise<CompletedMatchAnnouncement[]> {
  const lateBracketCompleted = completedSets.filter(
    (set) => set.winnerId != null && isNotableMatch(set, topSeedEntrantIds),
  );
  if (lateBracketCompleted.length === 0) return [];

  const alreadyAnnounced = await prisma.announcedSetResult.findMany({
    where: { setId: { in: lateBracketCompleted.map((set) => set.id) } },
    select: { setId: true },
  });
  const announcedIds = new Set(alreadyAnnounced.map((a) => a.setId));

  const newlyCompleted = lateBracketCompleted.filter((set) => !announcedIds.has(set.id));
  if (newlyCompleted.length === 0) return [];

  const results: CompletedMatchAnnouncement[] = [];

  for (const set of newlyCompleted) {
    await resolveSetBets(set);

    const winnerId = String(set.winnerId);
    const winnerSlot = set.slots.find((slot) => slot.entrant?.id === winnerId);
    const loserSlot = set.slots.find((slot) => slot.entrant && slot.entrant.id !== winnerId);

    // Marque le set comme annoncé même sans les deux entrants résolus, pour
    // ne pas retenter indéfiniment un set aux données incomplètes.
    await prisma.announcedSetResult
      .create({ data: { setId: set.id, eventSlug: tournament.eventSlug } })
      .catch(() => undefined); // couru par un autre passage concurrent : doublon ignoré

    if (!winnerSlot?.entrant || !loserSlot?.entrant) continue;

    results.push({
      winnerName: winnerSlot.entrant.name,
      loserName: loserSlot.entrant.name,
      winnerScore: winnerSlot.score,
      loserScore: loserSlot.score,
    });
  }

  return results;
}

/**
 * Un message par résultat, regroupés en un seul envoi chat si plusieurs
 * matchs se terminent au même passage (anti-flood).
 */
export function formatMatchResultMessage(results: CompletedMatchAnnouncement[]): string {
  const lines = results.map((r) =>
    r.winnerScore != null && r.loserScore != null
      ? `${r.winnerName} a gagné ${r.winnerScore}-${r.loserScore} contre ${r.loserName}`
      : `${r.winnerName} a gagné contre ${r.loserName}`,
  );
  return results.length === 1 ? `${lines[0]} !` : `Résultats : ${lines.join(" | ")} !`;
}
