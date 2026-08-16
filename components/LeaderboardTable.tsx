export interface LeaderboardRow {
  username: string;
  points: number;
  won?: number;
  lost?: number;
  pending?: number;
  /** Nombre de tournois distincts sur lesquels le parieur a misé (classement global uniquement). */
  tournamentsCount?: number;
}

const MEDAL_BY_RANK: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

export default function LeaderboardTable({
  rows,
  emptyLabel,
  showTournamentsColumn = false,
  showRecordColumns = true,
}: {
  rows: LeaderboardRow[];
  emptyLabel: string;
  showTournamentsColumn?: boolean;
  showRecordColumns?: boolean;
}) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ background: "var(--surface-alt)", color: "var(--muted)" }}>
            <th className="px-4 py-2 font-medium">#</th>
            <th className="px-4 py-2 font-medium">Parieur</th>
            <th className="px-4 py-2 font-medium">Ex</th>
            {showRecordColumns && (
              <>
                <th className="px-4 py-2 font-medium">Gagnés</th>
                <th className="px-4 py-2 font-medium">Perdus</th>
                <th className="px-4 py-2 font-medium">En attente</th>
              </>
            )}
            {showTournamentsColumn && <th className="px-4 py-2 font-medium">Tournois</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const medal = MEDAL_BY_RANK[i];
            return (
              <tr key={row.username} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-2" style={{ color: "var(--muted)" }}>
                  {i + 1}
                </td>
                <td className="px-4 py-2 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {medal && <span>{medal}</span>}
                    {row.username}
                  </span>
                </td>
                <td className="px-4 py-2 font-semibold" style={{ color: "var(--gold)" }}>
                  {row.points}
                </td>
                {showRecordColumns && (
                  <>
                    <td className="px-4 py-2" style={{ color: "var(--win)" }}>
                      {row.won ?? 0}
                    </td>
                    <td className="px-4 py-2" style={{ color: "var(--lose)" }}>
                      {row.lost ?? 0}
                    </td>
                    <td className="px-4 py-2" style={{ color: "var(--muted)" }}>
                      {row.pending ?? 0}
                    </td>
                  </>
                )}
                {showTournamentsColumn && (
                  <td className="px-4 py-2" style={{ color: "var(--muted)" }}>
                    {row.tournamentsCount ?? 0}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="p-4 text-sm" style={{ color: "var(--muted)" }}>
          {emptyLabel}
        </p>
      )}
    </div>
  );
}
