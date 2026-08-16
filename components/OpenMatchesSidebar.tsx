import BetCard from "@/components/BetCard";
import type { StartggSet } from "@/lib/startgg";

interface Entrant {
  id: string;
  name: string;
  seedNum: number | null;
  odds: number;
}

interface ExistingBet {
  entrantName: string;
  stake: number;
  odds: number;
  status: "PENDING" | "WON" | "LOST";
  payout: number;
}

export interface OpenMatchEntry {
  set: StartggSet;
  entrants: Entrant[];
  bet: ExistingBet | null;
}

/**
 * Sidebar persistante listant les matchs classiques actuellement ouverts au
 * pari : à partir du Top 24 (inclus), tous les matchs ouverts ; avant, les
 * matchs ouverts impliquant au moins un des 16 meilleurs seeds du tournoi
 * (voir isNotableMatch) — un aperçu de "ce qui se parie là, maintenant" sans
 * avoir à déplier round par round dans la liste principale. Chaque entrée
 * permet de parier directement (même BetCard que la liste principale) ou de
 * sauter au match correspondant plus bas sur la page.
 */
export default function OpenMatchesSidebar({
  tournamentId,
  entries,
  exBalance,
}: {
  tournamentId: string;
  entries: OpenMatchEntry[];
  exBalance: number;
}) {
  return (
    <aside className="hidden lg:block w-72 shrink-0">
      <div
        className="card p-4 flex flex-col gap-3 sticky top-4 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 2rem)" }}
      >
        <p className="text-sm font-semibold">
          Paris ouverts{entries.length > 0 ? ` · ${entries.length}` : ""}
        </p>

        {entries.length === 0 && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Aucun pari ouvert pour l&apos;instant.
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
              <a
                href={`#set-${set.id}`}
                className="text-xs underline whitespace-nowrap"
                style={{ color: "var(--accent)" }}
              >
                Voir le match
              </a>
            </div>
            <BetCard
              tournamentId={tournamentId}
              setId={set.id}
              entrants={entrants}
              locked={false}
              exBalance={exBalance}
              existingBet={bet}
            />
          </div>
        ))}
      </div>
    </aside>
  );
}
