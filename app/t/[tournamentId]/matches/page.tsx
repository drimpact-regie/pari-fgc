import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTournament } from "@/lib/tournaments";
import {
  getPhaseGroupTopSeeds,
  getUpcomingSets,
  SET_STATE,
  StartggApiError,
  type StartggSeed,
  type StartggSet,
} from "@/lib/startgg";
import BetCard from "@/components/BetCard";

interface RoundGroup {
  label: string;
  phaseGroupId: string | null;
  sets: StartggSet[];
}

/**
 * Regroupe les sets par étape (round) ET par poule (phaseGroup), en
 * conservant l'ordre déjà renvoyé par start.gg (sortType: STANDARD). Deux
 * poules en parallèle peuvent partager le même libellé de round ("Round 1"),
 * il faut donc les distinguer par phaseGroupId pour ne pas les fusionner.
 */
function groupByRound(sets: StartggSet[]): RoundGroup[] {
  const groups = new Map<string, RoundGroup>();
  for (const set of sets) {
    const key = `${set.fullRoundText || "Autre"}::${set.phaseGroupId ?? ""}`;
    const group = groups.get(key);
    if (group) {
      group.sets.push(set);
    } else {
      const label = set.poolLabel
        ? `${set.fullRoundText || "Autre"} — Poule ${set.poolLabel}`
        : set.fullRoundText || "Autre";
      groups.set(key, { label, phaseGroupId: set.phaseGroupId, sets: [set] });
    }
  }
  return Array.from(groups.values());
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

  const roundGroups = groupByRound(sets);

  // Têtes de série affichées uniquement pour les poules identifiées (plusieurs
  // groupes en parallèle) — pas pour chaque round d'un bracket classique, où
  // ce serait redondant. Purement cosmétique : une poule sans seeds
  // disponibles reste affichée sans la ligne "Têtes de série".
  const poolGroups = roundGroups.filter(
    (g) => g.phaseGroupId && g.sets.some((s) => s.poolLabel),
  );
  const seedsByPhaseGroup = new Map<string, StartggSeed[]>(
    (
      await Promise.all(
        poolGroups.map(async (g) => {
          try {
            const seeds = await getPhaseGroupTopSeeds(g.phaseGroupId!, 4);
            return [g.phaseGroupId!, seeds] as const;
          } catch {
            return [g.phaseGroupId!, [] as StartggSeed[]] as const;
          }
        }),
      )
    ).filter(([, seeds]) => seeds.length > 0),
  );

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

      {roundGroups.map((group) => {
        const openCount = group.sets.filter(
          (set) => set.state === SET_STATE.NOT_STARTED,
        ).length;
        const seeds = group.phaseGroupId ? seedsByPhaseGroup.get(group.phaseGroupId) : undefined;

        return (
          <details key={group.label + group.phaseGroupId} className="card group" open={false}>
            <summary
              className="flex flex-col gap-1 px-4 py-3 cursor-pointer select-none list-none"
              style={{ borderLeft: "3px solid var(--accent)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold uppercase tracking-wide">
                  {group.label}
                </span>
                <span className="text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>
                  {group.sets.length} match{group.sets.length > 1 ? "s" : ""}
                  {openCount > 0 ? ` · ${openCount} ouvert${openCount > 1 ? "s" : ""}` : ""}
                </span>
              </div>
              {seeds && seeds.length > 0 && (
                <p className="text-xs italic" style={{ color: "var(--muted)" }}>
                  Têtes de série :{" "}
                  {seeds.map((s) => `${s.entrantName} (#${s.seedNum})`).join(", ")}
                </p>
              )}
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 pt-0">
              {group.sets.map((set) => {
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
