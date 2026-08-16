import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTournament } from "@/lib/tournaments";
import {
  getEventPhases,
  getPhaseGroupTopSeeds,
  getUpcomingSets,
  isLateBracketRound,
  isSetOpenForBetting,
  SET_STATE,
  StartggApiError,
  type StartggEntrant,
  type StartggPhase,
  type StartggSeed,
  type StartggSet,
} from "@/lib/startgg";
import BetCard from "@/components/BetCard";
import ActiveChatSetButton from "@/components/ActiveChatSetButton";
import OpenMatchesSidebar, { type OpenMatchEntry } from "@/components/OpenMatchesSidebar";

interface RoundGroup {
  label: string;
  phaseGroupId: string | null;
  sets: StartggSet[];
}

interface PhaseSection {
  phaseId: string;
  phaseName: string;
  roundGroups: RoundGroup[];
}

/**
 * Regroupe les sets par étape/bracket (phase) puis par round et poule
 * (phaseGroup) à l'intérieur, en conservant l'ordre déjà renvoyé par
 * start.gg. Toutes les phases de l'event apparaissent, même celles sans
 * set actuellement disponible (bracket pas encore ouvert) — c'est le but :
 * voir l'agenda complet et pouvoir déplier une étape dès qu'elle s'ouvre.
 */
function buildPhaseSections(phases: StartggPhase[], sets: StartggSet[]): PhaseSection[] {
  const sections = new Map<string, PhaseSection>();
  for (const phase of phases) {
    sections.set(phase.id, { phaseId: phase.id, phaseName: phase.name, roundGroups: [] });
  }

  const roundGroupsByKey = new Map<string, RoundGroup>();

  for (const set of sets) {
    const phaseId = set.phaseId ?? "autre";
    let section = sections.get(phaseId);
    if (!section) {
      section = { phaseId, phaseName: set.phaseName ?? "Autre", roundGroups: [] };
      sections.set(phaseId, section);
    }

    const roundKey = `${phaseId}::${set.fullRoundText || "Autre"}::${set.phaseGroupId ?? ""}`;
    let roundGroup = roundGroupsByKey.get(roundKey);
    if (!roundGroup) {
      const label = set.poolLabel
        ? `${set.fullRoundText || "Autre"} — Poule ${set.poolLabel}`
        : set.fullRoundText || "Autre";
      roundGroup = { label, phaseGroupId: set.phaseGroupId, sets: [] };
      roundGroupsByKey.set(roundKey, roundGroup);
      section.roundGroups.push(roundGroup);
    }
    roundGroup.sets.push(set);
  }

  return Array.from(sections.values());
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

  let sets: StartggSet[] = [];
  let phases: StartggPhase[] = [];
  let error: string | null = null;
  try {
    [sets, phases] = await Promise.all([
      getUpcomingSets(tournament.eventSlug),
      getEventPhases(tournament.eventSlug),
    ]);
  } catch (err) {
    error = err instanceof StartggApiError ? err.message : "Erreur inconnue.";
  }

  const userBets = await prisma.bet.findMany({
    where: { userId: session.user.id, eventSlug: tournament.eventSlug },
  });
  const betBySetId = new Map(userBets.map((bet) => [bet.setId, bet]));

  const phaseSections = buildPhaseSections(phases, sets);

  // Sidebar "matchs ouverts" : aperçu des matchs classiques réellement
  // pariables (state NOT_STARTED, deux entrants connus) dans les phases
  // finales tardives (Top N tardif, grande finale), tous rounds confondus,
  // sans avoir à déplier round par round dans la liste principale.
  const openMatchEntries: OpenMatchEntry[] = sets
    .filter((set) => isLateBracketRound(set.fullRoundText) && isSetOpenForBetting(set))
    .map((set) => ({
      set,
      entrants: set.slots
        .filter(
          (slot): slot is typeof slot & { entrant: StartggEntrant } => slot.entrant !== null,
        )
        .map((slot) => ({ id: slot.entrant.id, name: slot.entrant.name, seedNum: slot.seedNum })),
      bet: betBySetId.get(set.id),
    }));

  // Têtes de série affichées uniquement pour les poules identifiées — pas
  // pour chaque round d'un bracket classique, où ce serait redondant.
  const poolGroups = phaseSections
    .flatMap((s) => s.roundGroups)
    .filter((g) => g.phaseGroupId && g.sets.some((s) => s.poolLabel));
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
    <div className="flex gap-4 items-start">
      <OpenMatchesSidebar tournamentId={tournamentId} entries={openMatchEntries} />

      <div className="flex-1 min-w-0 flex flex-col gap-4">
      {error && (
        <div className="card p-4" style={{ color: "var(--lose)" }}>
          Impossible de récupérer les matchs depuis start.gg : {error}
        </div>
      )}

      {!error && phaseSections.length === 0 && (
        <p style={{ color: "var(--muted)" }}>Aucune étape disponible pour le moment.</p>
      )}

      {phaseSections.map((phase) => {
        const totalSets = phase.roundGroups.reduce((n, g) => n + g.sets.length, 0);
        const openSets = phase.roundGroups.reduce(
          (n, g) => n + g.sets.filter((s) => s.state === SET_STATE.NOT_STARTED).length,
          0,
        );

        return (
          <details key={phase.phaseId} className="card">
            <summary
              className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none list-none"
              style={{ borderLeft: "3px solid var(--accent)" }}
            >
              <span className="text-base font-bold">{phase.phaseName}</span>
              <span className="text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>
                {totalSets === 0
                  ? "Pas encore ouvert"
                  : `${totalSets} match${totalSets > 1 ? "s" : ""}${openSets > 0 ? ` · ${openSets} ouvert${openSets > 1 ? "s" : ""}` : ""}`}
              </span>
            </summary>

            <div className="flex flex-col gap-3 p-4 pt-0">
              {phase.roundGroups.length === 0 && (
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Cette étape n&apos;est pas encore disponible sur start.gg (bracket pas
                  encore généré).
                </p>
              )}

              {phase.roundGroups.map((group) => {
                const openCount = group.sets.filter(
                  (set) => set.state === SET_STATE.NOT_STARTED,
                ).length;
                const seeds = group.phaseGroupId
                  ? seedsByPhaseGroup.get(group.phaseGroupId)
                  : undefined;

                return (
                  <details
                    key={group.label + group.phaseGroupId}
                    className="card"
                    style={{ background: "var(--surface-alt)" }}
                    open={false}
                  >
                    <summary
                      className="flex flex-col gap-1 px-4 py-3 cursor-pointer select-none list-none"
                      style={{ borderLeft: "3px solid var(--accent)" }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold uppercase tracking-wide">
                          {group.label}
                        </span>
                        <span
                          className="text-xs whitespace-nowrap"
                          style={{ color: "var(--muted)" }}
                        >
                          {group.sets.length} match{group.sets.length > 1 ? "s" : ""}
                          {openCount > 0
                            ? ` · ${openCount} ouvert${openCount > 1 ? "s" : ""}`
                            : ""}
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
                          .filter(
                            (slot): slot is typeof slot & { entrant: StartggEntrant } =>
                              slot.entrant !== null,
                          )
                          .map((slot) => ({
                            id: slot.entrant.id,
                            name: slot.entrant.name,
                            seedNum: slot.seedNum,
                          }));
                        const bet = betBySetId.get(set.id);

                        return (
                          <div id={`set-${set.id}`} key={set.id} className="flex flex-col gap-1 scroll-mt-4">
                            {session.user.isAdmin &&
                              tournament.twitchChannel &&
                              set.state === SET_STATE.NOT_STARTED && (
                                <div className="self-end">
                                  <ActiveChatSetButton
                                    tournamentId={tournamentId}
                                    setId={set.id}
                                    active={tournament.activeChatSetId === set.id}
                                  />
                                </div>
                              )}
                            <BetCard
                              tournamentId={tournamentId}
                              setId={set.id}
                              entrants={entrants}
                              totalGames={set.totalGames}
                              locked={set.state !== SET_STATE.NOT_STARTED}
                              existingBetEntrantName={bet?.predictedEntrantName ?? null}
                              existingBetEntrantScore={bet?.predictedEntrantScore ?? null}
                              existingBetOpponentScore={bet?.predictedOpponentScore ?? null}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          </details>
        );
      })}
      </div>
    </div>
  );
}
