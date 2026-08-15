import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getTournament } from "@/lib/tournaments";
import LeaderboardTable from "@/components/LeaderboardTable";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const tournament = await getTournament(tournamentId);
  if (!tournament) notFound();

  const users = await prisma.user.findMany({
    include: { bets: { where: { eventSlug: tournament.eventSlug } } },
  });

  const rows = users
    .map((user) => {
      const won = user.bets.filter((b) => b.status === "WON").length;
      const lost = user.bets.filter((b) => b.status === "LOST").length;
      const pending = user.bets.filter((b) => b.status === "PENDING").length;
      const points = user.bets.reduce((sum, b) => sum + b.pointsAwarded, 0);
      return { username: user.username, points, won, lost, pending };
    })
    .filter((row) => row.won + row.lost + row.pending > 0)
    .sort((a, b) => b.points - a.points || b.won - a.won);

  return (
    <div className="flex flex-col gap-4">
      <LeaderboardTable rows={rows} emptyLabel="Personne n'a encore parié sur ce tournoi." />
    </div>
  );
}
