import BetCard from "@/components/BetCard";
import type { StartggSet } from "@/lib/startgg";

interface Entrant {
  id: string;
  name: string;
  seedNum: number | null;
}

interface ExistingBet {
  predictedEntrantName: string;
  predictedEntrantScore: number | null;
  predictedOpponentScore: number | null;
}

export interface OpenMatchEntry {
  set: StartggSet;
  entrants: Entrant[];
  bet: ExistingBet | undefined;
}

/**
 * Sidebar persistante listant les matchs classiques actuellement ouverts au
 * pari, à partir des phases finales tardives (Top N tardif, grande finale —
 * voir isLateBracketRound) : un aperçu de "ce qui se parie là, maintenant"
 * sans avoir à déplier round par round dans la liste principale. Chaque
 * entrée permet de parier directement (même BetCard que la liste
 * principale) ou de sauter au match correspondant plus bas sur la page.
 */
export default function OpenMatchesSidebar({
  tournamentId,
  entries,
}: {
  tournamentId: string;
  entries: OpenMatchEntry[];
}) {
  return (
    <aside className="hidden lg:block w-72 shrink-0">
      <div
        className="card p-4 flex flex-col gap-3 sticky top-4 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 2rem)" }}
      >
        <p className="text-sm font-semibold">
          Matchs ouverts (phases finales){entries.length > 0 ? ` · ${entries.length}` : ""}
        </p>

        {entries.length === 0 && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Aucun match ouvert au pari pour l&apos;instant à partir du Top 24.
          </p>
        )}

        {entries.map(({ set, entrants, bet }) => (
          <div
            key={set.id}
            className="flex flex-col gap-1 pb-3 border-b last:border-b-0"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--muted)" }}
              >
                {set.fullRoundText}
              </span>
              <a href={`#set-${set.id}`} className="text-xs underline whitespace-nowrap" style={{ color: "var(--accent)" }}>
                Voir le match
              </a>
            </div>
            <BetCard
              tournamentId={tournamentId}
              setId={set.id}
              entrants={entrants}
              totalGames={set.totalGames}
              locked={false}
              existingBetEntrantName={bet?.predictedEntrantName ?? null}
              existingBetEntrantScore={bet?.predictedEntrantScore ?? null}
              existingBetOpponentScore={bet?.predictedOpponentScore ?? null}
            />
          </div>
        ))}
      </div>
    </aside>
  );
}
