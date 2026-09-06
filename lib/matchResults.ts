import type { Tournament } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { computeMatchBetPayout } from "@/lib/odds";
import {
  getCompletedSetsWithTruncation,
  getSetResult,
  isNotableMatch,
  isPreviewSetId,
  SET_STATE,
  StartggApiError,
  type StartggSet,
} from "@/lib/startgg";

export interface WonBetPayout {
  userId: string;
  eventSlug: string;
  payout: number;
}

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
 *
 * `wonPayouts` (paris gagnés avec gain > 0) sert à détecter une progression
 * au classement LeaderBet du tournoi juste après (voir
 * checkAndAnnounceResults côté webhook) — `resolvedCount` reste le total
 * gagnés+perdus, pour ne pas changer le sens des compteurs déjà affichés à
 * l'admin (voir resolveAllPendingBets).
 */
export async function resolveSetBets(
  set: StartggSet,
): Promise<{ resolvedCount: number; wonPayouts: WonBetPayout[] }> {
  if (set.state !== SET_STATE.COMPLETED || set.winnerId == null) {
    return { resolvedCount: 0, wonPayouts: [] };
  }

  const winnerId = String(set.winnerId);
  const bets = await prisma.bet.findMany({ where: { setId: set.id, status: "PENDING" } });
  const wonPayouts: WonBetPayout[] = [];

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

    if (payout > 0) wonPayouts.push({ userId: bet.userId, eventSlug: bet.eventSlug, payout });
  }

  return { resolvedCount: bets.length, wonPayouts };
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
  /** Tous jeux/tournois confondus (résolution globale) — voir WonBetPayout. */
  wonPayouts: WonBetPayout[];
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
 * getCompletedSetsWithTruncation, une requête paginée couvrant tous les sets
 * terminés d'un coup), plutôt qu'une requête getSetResult séparée par pari
 * en attente — avec beaucoup de paris en attente en simultané (tournoi
 * actif, chat qui déclenche ce passage toutes les 30s), l'ancienne approche
 * pouvait facilement dépasser le rate-limit de l'API start.gg (429). Un
 * appel getSetResult ciblé n'est fait qu'en repli, set par set, quand cette
 * liste paginée s'avère tronquée ET que le set parié n'y figure pas (voir
 * plus bas) — ça reste borné par le nombre de sets encore en attente, pas
 * par la taille du tournoi.
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
  const wonPayouts: WonBetPayout[] = [];

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
    let truncated: boolean;
    try {
      ({ sets: completedSets, truncated } = await getCompletedSetsWithTruncation(eventSlug));
    } catch (err) {
      errors.push(
        err instanceof StartggApiError ? `${eventSlug}: ${err.message}` : `${eventSlug}: erreur inconnue`,
      );
      continue;
    }

    const completedById = new Map(completedSets.map((set) => [set.id, set]));
    for (const setId of setIds) {
      let set = completedById.get(setId);

      // La liste des sets terminés est plafonnée en pagination (voir
      // MAX_PAGES dans lib/startgg.ts) : pour un gros event (poules + bracket
      // cumulant beaucoup de sets terminés), un set de fin de bracket peut en
      // être absent alors qu'il est bel et bien terminé. Dans ce cas précis
      // (liste tronquée ET set introuvable dedans), on va le chercher
      // individuellement plutôt que de laisser le pari bloqué en attente
      // indéfiniment — un set réellement pas encore joué, lui, n'entraîne
      // jamais cet appel supplémentaire tant que la liste n'est pas tronquée.
      if (!set && truncated) {
        try {
          const direct = await getSetResult(setId);
          if (direct && direct.state === SET_STATE.COMPLETED) set = direct;
        } catch {
          // best-effort — retentera au prochain passage.
        }
      }

      if (!set) continue; // pas encore terminé côté start.gg

      const { resolvedCount, wonPayouts: setWonPayouts } = await resolveSetBets(set);
      if (resolvedCount > 0) {
        resolvedSets += 1;
        resolvedBets += resolvedCount;
        wonPayouts.push(...setWonPayouts);
      }
    }
  }

  return { resolvedSets, resolvedBets, cancelledBets, errors, wonPayouts };
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

export interface TournamentLeaderboardEntry {
  rank: number;
  points: number;
}

/**
 * Classement LeaderBet d'un tournoi (même tri que
 * app/(site)/t/[tournamentId]/leaderboard/page.tsx : points = somme des
 * gains des paris classiques du parieur sur CE tournoi, puis victoires en
 * cas d'égalité) — extrait ici pour être réutilisable côté détection de
 * progression au classement (voir checkAndAnnounceResults, webhook Twitch),
 * qui a besoin d'un instantané avant/après résolution. N'inclut que les
 * parieurs ayant au moins un pari (gagné/perdu/en attente) sur ce tournoi,
 * comme la page.
 */
export async function computeTournamentLeaderboardRanks(
  eventSlug: string,
): Promise<Map<string, TournamentLeaderboardEntry>> {
  const users = await prisma.user.findMany({ include: { bets: { where: { eventSlug } } } });

  const rows = users
    .map((user) => {
      const won = user.bets.filter((b) => b.status === "WON").length;
      const lost = user.bets.filter((b) => b.status === "LOST").length;
      const pending = user.bets.filter((b) => b.status === "PENDING").length;
      const points = user.bets.reduce((sum, b) => sum + b.pointsAwarded, 0);
      return { userId: user.id, points, won, active: won + lost + pending > 0 };
    })
    .filter((row) => row.active)
    .sort((a, b) => b.points - a.points || b.won - a.won);

  const ranks = new Map<string, TournamentLeaderboardEntry>();
  rows.forEach((row, i) => ranks.set(row.userId, { rank: i + 1, points: row.points }));
  return ranks;
}

const LEADERBOARD_MEDAL_BY_RANK: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** Message de progression au classement LeaderBet d'un tournoi (voir checkAndAnnounceResults). */
export function formatLeaderboardClimbMessage(
  username: string,
  payout: number,
  entry: TournamentLeaderboardEntry,
): string {
  const medal = LEADERBOARD_MEDAL_BY_RANK[entry.rank];
  return `@${username} tu as gagné ${payout} Ex${medal ? ` ${medal}` : ""} ${username} ${entry.points}`;
}
