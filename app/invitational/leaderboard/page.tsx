import { prisma } from "@/lib/prisma";
import LeaderboardTable from "@/components/LeaderboardTable";

export const dynamic = "force-dynamic";

export default async function InvitationalLeaderboardPage() {
  const users = await prisma.user.findMany({ include: { invitationalBets: true } });

  const rows = users
    .map((user) => {
      const won = user.invitationalBets.filter((b) => b.status === "WON").length;
      const lost = user.invitationalBets.filter((b) => b.status === "LOST").length;
      const pending = user.invitationalBets.filter((b) => b.status === "PENDING").length;
      const points = user.invitationalBets.reduce((sum, b) => sum + b.pointsAwarded, 0);
      return { username: user.username, points, won, lost, pending };
    })
    .filter((row) => row.won + row.lost + row.pending > 0)
    .sort((a, b) => b.points - a.points || b.won - a.won);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Classement scoré uniquement sur les paris Invitational / Prestataire — économie séparée du
        LeaderBet classique.
      </p>
      <LeaderboardTable rows={rows} emptyLabel="Personne n'a encore parié sur un event Invitational." />
    </div>
  );
}
