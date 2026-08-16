import type { Tournament } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { computeMatchBetPayout } from "@/lib/odds";
import {
  getCompletedSets,
  isNotableMatch,
  isPreviewSetId,
  SET_STATE,
  StartggApiError,
  type StartggSet,
} from "@/lib/startgg";

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

/**
 * Annule tous les paris PENDING d'un match "prévisionnel" (voir
 * isPreviewSetId) : ce n'est pas un vrai match, il ne se terminera jamais
 * côté start.gg, donc ces paris resteraient bloqués en attente pour
 * toujours si on se contentait d'interroger start.gg comme pour un match
 * normal. Rembourse la mise si elle avait été débitée (normalement 0 pour
 * ces paris légués, mais par sécurité si stake > 0).
 */
async function cancelBetsForPreviewSet(setId: string): Promise<number> {
  const bets = await prisma.bet.findMany({ where: { setId, status: "PENDING" } });

  for (const bet of bets) {
    await prisma.$transaction([
      prisma.bet.update({
        where: { id: bet.id },
        data: { status: "CANCELLED", pointsAwarded: 0, resolvedAt: new Date() },
      }),
      ...(bet.stake && bet.stake > 0
        ? [
            prisma.user.update({
              where: { id: bet.userId },
              data: { exBalance: { increment: bet.stake } },
            }),
          ]
        : []),
    ]);
  }

  return bets.length;
}

export interface ResolveAllPendingBetsResult {
  resolvedSets: number;
  resolvedBets: number;
  cancelledBets: number;
  errors: string[];
}

/**
 * Balaie tous les matchs sur lesquels il reste au moins un pari PENDING
 * (n'importe quel round, pas seulement les phases finales tardives — voir
 * isNotableMatch, qui ne s'applique qu'à la sidebar et aux annonces chat, pas
 * à la résolution) et résout ceux dont le set est terminé côté start.gg, ou
 * annule ceux placés sur un match "prévisionnel" (voir cancelBetsForPreviewSet
 * — ces id ne sont jamais interrogés côté start.gg, ça ne mènerait à rien).
 *
 * Interroge start.gg au maximum une fois par event distinct concerné (via
 * getCompletedSets, une requête paginée couvrant tous les sets terminés d'un
 * coup), plutôt qu'une requête getSetResult séparée par pari en attente —
 * avec beaucoup de paris en attente en simultané (tournoi actif, chat qui
 * déclenche ce passage toutes les 30s), l'ancienne approche pouvait
 * facilement dépasser le rate-limit de l'API start.gg (429).
 *
 * Point de résolution unique et idempotent, appelé aussi bien par l'action
 * admin manuelle (/api/admin/sync-results) que par le déclenchement
 * automatique côté webhook Twitch (voir app/api/twitch/webhook/route.ts),
 * pour ne pas dépendre d'un clic admin à chaque match terminé.
 */
export async function resolveAllPendingBets(): Promise<ResolveAllPendingBetsResult> {
  const pendingBets = await prisma.bet.findMany({
    where: { status: "PENDING" },
    select: { setId: true, eventSlug: true },
  });

  let resolvedSets = 0;
  let resolvedBets = 0;
  let cancelledBets = 0;
  const errors: string[] = [];

  const previewSetIds = new Set(
    pendingBets.filter((b) => isPreviewSetId(b.setId)).map((b) => b.setId),
  );
  for (const setId of previewSetIds) {
    cancelledBets += await cancelBetsForPreviewSet(setId);
  }

  const pendingSetIdsByEventSlug = new Map<string, Set<string>>();
  for (const bet of pendingBets) {
    if (isPreviewSetId(bet.setId)) continue;
    if (!pendingSetIdsByEventSlug.has(bet.eventSlug)) {
      pendingSetIdsByEventSlug.set(bet.eventSlug, new Set());
    }
    pendingSetIdsByEventSlug.get(bet.eventSlug)!.add(bet.setId);
  }

  for (const [eventSlug, setIds] of pendingSetIdsByEventSlug) {
    let completedSets: StartggSet[];
    try {
      completedSets = await getCompletedSets(eventSlug);
    } catch (err) {
      errors.push(
        err instanceof StartggApiError ? `${eventSlug}: ${err.message}` : `${eventSlug}: erreur inconnue`,
      );
      continue;
    }

    const completedById = new Map(completedSets.map((set) => [set.id, set]));
    for (const setId of setIds) {
      const set = completedById.get(setId);
      if (!set) continue; // pas encore terminé côté start.gg

      const resolvedCount = await resolveSetBets(set);
      if (resolvedCount > 0) {
        resolvedSets += 1;
        resolvedBets += resolvedCount;
      }
    }
  }

  return { resolvedSets, resolvedBets, cancelledBets, errors };
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
