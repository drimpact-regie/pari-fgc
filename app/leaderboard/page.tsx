import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const users = await prisma.user.findMany({
    include: { bets: true },
  });

  const rows = users
    .map((user) => {
      const won = user.bets.filter((b) => b.status === "WON").length;
      const lost = user.bets.filter((b) => b.status === "LOST").length;
      const pending = user.bets.filter((b) => b.status === "PENDING").length;
      const points = user.bets.reduce((sum, b) => sum + b.pointsAwarded, 0);
      return { username: user.username, points, won, lost, pending };
    })
    .sort((a, b) => b.points - a.points || b.won - a.won);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Classement des parieurs</h1>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left"
              style={{ background: "var(--surface-alt)", color: "var(--muted)" }}
            >
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Parieur</th>
              <th className="px-4 py-2 font-medium">Points</th>
              <th className="px-4 py-2 font-medium">Gagnés</th>
              <th className="px-4 py-2 font-medium">Perdus</th>
              <th className="px-4 py-2 font-medium">En attente</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.username} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-2" style={{ color: "var(--muted)" }}>
                  {i + 1}
                </td>
                <td className="px-4 py-2 font-medium">{row.username}</td>
                <td className="px-4 py-2 font-semibold" style={{ color: "var(--accent)" }}>
                  {row.points}
                </td>
                <td className="px-4 py-2" style={{ color: "var(--win)" }}>
                  {row.won}
                </td>
                <td className="px-4 py-2" style={{ color: "var(--lose)" }}>
                  {row.lost}
                </td>
                <td className="px-4 py-2" style={{ color: "var(--muted)" }}>
                  {row.pending}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-4 text-sm" style={{ color: "var(--muted)" }}>
            Personne n&apos;a encore parié.
          </p>
        )}
      </div>
    </div>
  );
}
