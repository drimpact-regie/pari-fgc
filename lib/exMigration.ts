import { prisma } from "@/lib/prisma";
import { computeTop8PickPoints } from "@/lib/scoring";

interface StoredPick {
  entrantId: string;
  entrantName: string;
}

interface StandingEntry {
  entrant: { id: string } | null;
  placement: number | null;
}

/**
 * Récupère le classement final d'un event start.gg. Injecté plutôt
 * qu'appelé en dur (comme getStandings de lib/startgg) pour que la logique
 * d'agrégation ci-dessous reste testable sans réseau.
 */
export type StandingsFetcher = (eventSlug: string) => Promise<StandingEntry[]>;

export interface UserBalanceMigrationResult {
  userId: string;
  username: string;
  previousBalance: number;
  historicalTotal: number;
  newBalance: number;
  changed: boolean;
}

/**
 * Calcule, pour chaque utilisateur, la somme de tous ses gains déjà
 * accumulés avant l'introduction d'Ex (paris classiques + MVC + reset de
 * bracket + Top 8 pondéré par placement réel — ce dernier nécessite les
 * classements finaux via start.gg, d'où `fetchStandings` injecté). Écrase
 * exBalance par ce total UNIQUEMENT s'il est strictement positif (sinon
 * l'utilisateur garde son solde déjà en place, en général
 * DEFAULT_STARTING_EX) — jamais additionné à l'existant, pour rester
 * idempotent si ce script est relancé plusieurs fois de suite.
 */
export async function migrateExBalances(
  fetchStandings: StandingsFetcher,
): Promise<UserBalanceMigrationResult[]> {
  const [users, bets, mvcBets, bracketResetBets, topEightPicks] = await Promise.all([
    prisma.user.findMany({ select: { id: true, username: true, exBalance: true } }),
    prisma.bet.findMany({ select: { userId: true, pointsAwarded: true } }),
    prisma.mvcBet.findMany({ select: { userId: true, pointsAwarded: true } }),
    prisma.bracketResetBet.findMany({ select: { userId: true, pointsAwarded: true } }),
    prisma.topEightPick.findMany({ select: { userId: true, eventSlug: true, picks: true } }),
  ]);

  const eventSlugs = Array.from(new Set(topEightPicks.map((p) => p.eventSlug)));
  const placementByEventSlug = new Map<string, Map<string, number | null>>();
  await Promise.all(
    eventSlugs.map(async (eventSlug) => {
      try {
        const standings = await fetchStandings(eventSlug);
        placementByEventSlug.set(
          eventSlug,
          new Map(standings.filter((s) => s.entrant).map((s) => [s.entrant!.id, s.placement])),
        );
      } catch {
        // Tournoi injoignable : ses pronostics Top 8 ne contribuent
        // simplement pas au total pour l'instant, plutôt que de faire
        // échouer toute la migration.
      }
    }),
  );

  const totalByUserId = new Map<string, number>();
  const add = (userId: string, amount: number) => {
    totalByUserId.set(userId, (totalByUserId.get(userId) ?? 0) + amount);
  };

  for (const bet of bets) add(bet.userId, bet.pointsAwarded);
  for (const mvc of mvcBets) add(mvc.userId, mvc.pointsAwarded);
  for (const reset of bracketResetBets) add(reset.userId, reset.pointsAwarded);
  for (const pick of topEightPicks) {
    const placementById = placementByEventSlug.get(pick.eventSlug);
    if (!placementById) continue;
    const picks = (pick.picks as unknown as StoredPick[]) ?? [];
    const points = picks.reduce(
      (sum, p) => sum + computeTop8PickPoints(placementById.get(p.entrantId) ?? null),
      0,
    );
    add(pick.userId, points);
  }

  const results: UserBalanceMigrationResult[] = [];
  for (const user of users) {
    const historicalTotal = totalByUserId.get(user.id) ?? 0;
    const changed = historicalTotal > 0 && historicalTotal !== user.exBalance;
    if (changed) {
      await prisma.user.update({ where: { id: user.id }, data: { exBalance: historicalTotal } });
    }
    results.push({
      userId: user.id,
      username: user.username,
      previousBalance: user.exBalance,
      historicalTotal,
      newBalance: historicalTotal > 0 ? historicalTotal : user.exBalance,
      changed,
    });
  }

  return results;
}
