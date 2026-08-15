import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTournament } from "@/lib/tournaments";
import { getUpcomingSets, SET_STATE, StartggApiError, type StartggSet } from "@/lib/startgg";
import BetCard from "@/components/BetCard";

/**
 * Regroupe les sets par étape (round) en conservant l'ordre déjà renvoyé par
 * start.gg (sortType: STANDARD), qui suit l'ordre logique du bracket.
 */
function groupByRound(sets: StartggSet[]): Map<string, StartggSet[]> {
  const groups = new Map<string, StartggSet[]>();
  for (const set of sets) {
    const key = set.fullRoundText || "Autre";
    const group = groups.get(key);
    if (group) {
      group.push(set);
    } else {
      groups.set(key, [set]);
    }
  }
  return groups;
}

export const dynamic = "force-dynamic";

export default async function MatchesPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const tournament = await getTournament(tournamentId);
  if (!tournament) notFound();

  let sets: Awaited<ReturnType<typeof getUpcomingSets>> = [];
  let error: string | null = null;
  try {
    sets = await getUpcomingSets(tournament.eventSlug);
  } catch (err) {
    error = err instanceof StartggApiError ? err.message : "Erreur inconnue.";
  }

  const userBets = await prisma.bet.findMany({
    where: { userId: session.user.id, eventSlug: tournament.eventSlug },
  });
  const betBySetId = new Map(userBets.map((bet) => [bet.setId, bet]));

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="card p-4" style={{ color: "var(--lose)" }}>
          Impossible de récupérer les matchs depuis start.gg : {error}
        </div>
      )}

      {!error && sets.length === 0 && (
        <p style={{ color: "var(--muted)" }}>Aucun match à venir pour le moment.</p>
      )}

      {Array.from(groupByRound(sets)).map(([roundText, roundSets]) => {
        const openCount = roundSets.filter(
          (set) => set.state === SET_STATE.NOT_STARTED,
        ).length;

        return (
          <details key={roundText} className="card group" open={false}>
            <summary
              className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none list-none"
              style={{ borderLeft: "3px solid var(--accent)" }}
            >
              <span className="text-sm font-semibold uppercase tracking-wide">
                {roundText}
              </span>
              <span className="text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>
                {roundSets.length} match{roundSets.length > 1 ? "s" : ""}
                {openCount > 0 ? ` · ${openCount} ouvert${openCount > 1 ? "s" : ""}` : ""}
              </span>
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 pt-0">
              {roundSets.map((set) => {
                const entrants = set.slots
                  .map((slot) => slot.entrant)
                  .filter((entrant): entrant is { id: string; name: string } => entrant !== null);
                const bet = betBySetId.get(set.id);

                return (
                  <BetCard
                    key={set.id}
                    tournamentId={tournamentId}
                    setId={set.id}
                    entrants={entrants}
                    locked={set.state !== SET_STATE.NOT_STARTED}
                    existingBetEntrantName={bet?.predictedEntrantName ?? null}
                  />
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
