import { prisma } from "@/lib/prisma";
import { getStandings, StartggApiError } from "@/lib/startgg";
import { computeTop8PickPoints } from "@/lib/scoring";
import LeaderboardTable from "@/components/LeaderboardTable";

export const dynamic = "force-dynamic";

interface StoredPick {
  entrantId: string;
  entrantName: string;
}

export default async function GlobalLeaderboardPage() {
  const [users, topEightPicks, mvcBets, bracketResetBets] = await Promise.all([
    prisma.user.findMany({ include: { bets: true } }),
    prisma.topEightPick.findMany({ include: { user: { select: { username: true } } } }),
    prisma.mvcBet.findMany({ include: { user: { select: { username: true } } } }),
    prisma.bracketResetBet.findMany({ include: { user: { select: { username: true } } } }),
  ]);

  // Points Top 8 pondérés par placement réel, calculés à la volée : il faut
  // le classement de chaque tournoi où au moins un pronostic a été fait.
  const eventSlugs = Array.from(new Set(topEightPicks.map((p) => p.eventSlug)));
  const placementByEventSlug = new Map<string, Map<string, number | null>>();
  await Promise.all(
    eventSlugs.map(async (eventSlug) => {
      try {
        const standings = await getStandings(eventSlug);
        placementByEventSlug.set(
          eventSlug,
          new Map(standings.filter((s) => s.entrant).map((s) => [s.entrant!.id, s.placement])),
        );
      } catch (err) {
        if (!(err instanceof StartggApiError)) throw err;
        // Tournoi injoignable : ses pronostics Top 8 ne contribuent simplement
        // pas au score global pour l'instant, plutôt que de faire échouer la
        // page entière.
      }
    }),
  );

  // Score "Le Pari du Parry" (Top 8 pondéré + MVC + reset de bracket),
  // séparé des points de paris sur matchs — additionné dans le total global
  // ci-dessous, mais pas dans le décompte Gagnés/Perdus/En attente qui reste
  // spécifique aux paris sur matchs (Bet).
  const parryPointsByUsername = new Map<string, number>();
  const usernamesWithParryActivity = new Set<string>();
  const addParryPoints = (username: string, points: number) => {
    parryPointsByUsername.set(username, (parryPointsByUsername.get(username) ?? 0) + points);
    usernamesWithParryActivity.add(username);
  };

  for (const pick of topEightPicks) {
    const placementById = placementByEventSlug.get(pick.eventSlug);
    const picks = (pick.picks as unknown as StoredPick[]) ?? [];
    const points = placementById
      ? picks.reduce(
          (sum, p) => sum + computeTop8PickPoints(placementById.get(p.entrantId) ?? null),
          0,
        )
      : 0;
    addParryPoints(pick.user.username, points);
  }
  for (const bet of mvcBets) addParryPoints(bet.user.username, bet.pointsAwarded);
  for (const bet of bracketResetBets) addParryPoints(bet.user.username, bet.pointsAwarded);

  const rows = users
    .map((user) => {
      const won = user.bets.filter((b) => b.status === "WON").length;
      const lost = user.bets.filter((b) => b.status === "LOST").length;
      const pending = user.bets.filter((b) => b.status === "PENDING").length;
      const matchPoints = user.bets.reduce((sum, b) => sum + b.pointsAwarded, 0);
      const parryPoints = parryPointsByUsername.get(user.username) ?? 0;
      const points = matchPoints + parryPoints;
      const tournamentsCount = new Set(user.bets.map((b) => b.eventSlug)).size;
      return { username: user.username, points, won, lost, pending, tournamentsCount };
    })
    .filter(
      (row) => row.won + row.lost + row.pending > 0 || usernamesWithParryActivity.has(row.username),
    )
    .sort((a, b) => b.points - a.points || b.won - a.won);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Classement cumulé sur tous les tournois suivis par Impact&apos;O Bet — paris sur
        matchs (LeaderBet) et Le Pari du Parry (Top 8, MVC, reset de bracket) additionnés.
      </p>
      <LeaderboardTable
        rows={rows}
        emptyLabel="Personne n'a encore parié."
        showTournamentsColumn
      />
    </div>
  );
}
