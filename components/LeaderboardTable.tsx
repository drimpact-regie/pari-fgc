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

/** Branche de laurier doré, dessinée en SVG (miroir via `flip` pour le côté droit). */
function LaurelBranch({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 40 64"
      width="18"
      height="29"
      style={{ transform: flip ? "scaleX(-1)" : undefined, flexShrink: 0 }}
      aria-hidden="true"
    >
      <path
        d="M30 62 C10 60 4 44 6 30 C8 16 18 4 26 2"
        fill="none"
        stroke="#e8b923"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g fill="#f2c744">
        <ellipse cx="8" cy="26" rx="6" ry="2.6" transform="rotate(-35 8 26)" />
        <ellipse cx="6" cy="34" rx="6" ry="2.6" transform="rotate(-20 6 34)" />
        <ellipse cx="7" cy="42" rx="6" ry="2.6" transform="rotate(-5 7 42)" />
        <ellipse cx="11" cy="49" rx="6" ry="2.6" transform="rotate(15 11 49)" />
        <ellipse cx="17" cy="55" rx="6" ry="2.6" transform="rotate(35 17 55)" />
        <ellipse cx="24" cy="59" rx="6" ry="2.6" transform="rotate(55 24 59)" />
        <ellipse cx="12" cy="18" rx="5.5" ry="2.4" transform="rotate(-50 12 18)" />
        <ellipse cx="18" cy="10" rx="5" ry="2.2" transform="rotate(-65 18 10)" />
      </g>
    </svg>
  );
}

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
            <th className="px-4 py-2 font-medium">Points</th>
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
                    {i === 0 && <LaurelBranch />}
                    {medal && <span>{medal}</span>}
                    {row.username}
                    {i === 0 && <LaurelBranch flip />}
                  </span>
                </td>
                <td className="px-4 py-2 font-semibold" style={{ color: "var(--accent)" }}>
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
