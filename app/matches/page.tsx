import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

export default async function MatchesPage() {
  const session = await auth();
  if (!session?.user) return null;

  let sets: Awaited<ReturnType<typeof getUpcomingSets>> = [];
  let error: string | null = null;
  try {
    sets = await getUpcomingSets();
  } catch (err) {
    error = err instanceof StartggApiError ? err.message : "Erreur inconnue.";
  }

  const userBets = await prisma.bet.findMany({
    where: { userId: session.user.id },
  });
  const betBySetId = new Map(userBets.map((bet) => [bet.setId, bet]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Matchs à venir</h1>

      {error && (
        <div className="card p-4" style={{ color: "var(--lose)" }}>
          Impossible de récupérer les matchs depuis start.gg : {error}
        </div>
      )}

      {!error && sets.length === 0 && (
        <p style={{ color: "var(--muted)" }}>Aucun match à venir pour le moment.</p>
      )}

      {Array.from(groupByRound(sets)).map(([roundText, roundSets]) => (
        <section key={roundText} className="flex flex-col gap-3">
          <h2
            className="text-sm font-semibold uppercase tracking-wide pl-3"
            style={{ borderLeft: "3px solid var(--accent)", color: "var(--foreground)" }}
          >
            {roundText}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roundSets.map((set) => {
              const entrants = set.slots
                .map((slot) => slot.entrant)
                .filter((entrant): entrant is { id: string; name: string } => entrant !== null);
              const bet = betBySetId.get(set.id);

              return (
                <BetCard
                  key={set.id}
                  setId={set.id}
                  entrants={entrants}
                  locked={set.state !== SET_STATE.NOT_STARTED}
                  existingBetEntrantName={bet?.predictedEntrantName ?? null}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
