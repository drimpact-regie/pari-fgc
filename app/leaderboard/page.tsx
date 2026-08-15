import { prisma } from "@/lib/prisma";
import LeaderboardTable from "@/components/LeaderboardTable";

export const dynamic = "force-dynamic";

export default async function GlobalLeaderboardPage() {
  const users = await prisma.user.findMany({ include: { bets: true } });

  const rows = users
    .map((user) => {
      const won = user.bets.filter((b) => b.status === "WON").length;
      const lost = user.bets.filter((b) => b.status === "LOST").length;
      const pending = user.bets.filter((b) => b.status === "PENDING").length;
      const points = user.bets.reduce((sum, b) => sum + b.pointsAwarded, 0);
      const tournamentsCount = new Set(user.bets.map((b) => b.eventSlug)).size;
      return { username: user.username, points, won, lost, pending, tournamentsCount };
    })
    .filter((row) => row.won + row.lost + row.pending > 0)
    .sort((a, b) => b.points - a.points || b.won - a.won);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Classement cumulé sur tous les tournois suivis par Impact&apos;O Bet.
      </p>
      <LeaderboardTable
        rows={rows}
        emptyLabel="Personne n'a encore parié."
        showTournamentsColumn
      />
    </div>
  );
}
