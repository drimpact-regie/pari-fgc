import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTournament } from "@/lib/tournaments";
import {
  getCompletedSets,
  getEventPhases,
  getEventTopSeedEntrantIds,
  getPhaseGroupsTopSeeds,
  getUpcomingSets,
  isLateBracketRound,
  isNotableMatch,
  isSetOpenForBetting,
  SET_STATE,
  StartggApiError,
  type StartggEntrant,
  type StartggPhase,
  type StartggSeed,
  type StartggSet,
} from "@/lib/startgg";
import { computeMatchOdds } from "@/lib/odds";
import { buildBracketLayout } from "@/lib/bracket";
import { FALLBACK_ODDS } from "@/config/tournament";
import BetCard from "@/components/BetCard";
import ActiveChatSetButton from "@/components/ActiveChatSetButton";
import OpenMatchesSidebar, { type OpenMatchEntry } from "@/components/OpenMatchesSidebar";
import Top8Bracket from "@/components/Top8Bracket";
import type { Bet } from "@prisma/client";

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

/** Entrants connus d'un set avec leur cote décimale calculée depuis les seeds (lib/odds.ts). */
function buildEntrantsWithOdds(set: StartggSet) {
  const known = set.slots.filter(
    (slot): slot is typeof slot & { entrant: StartggEntrant } => slot.entrant !== null,
  );
  if (known.length !== 2) {
    return known.map((slot) => ({
      id: slot.entrant.id,
      name: slot.entrant.name,
      seedNum: slot.seedNum,
      odds: FALLBACK_ODDS,
    }));
  }
  const [a, b] = known;
  const { oddsA, oddsB } = computeMatchOdds(a.seedNum, b.seedNum);
  return [
    { id: a.entrant.id, name: a.entrant.name, seedNum: a.seedNum, odds: oddsA },
    { id: b.entrant.id, name: b.entrant.name, seedNum: b.seedNum, odds: oddsB },
  ];
}

function buildExistingBet(bet: Bet | undefined) {
  if (!bet) return null;
  return {
    entrantName: bet.predictedEntrantName,
    stake: bet.stake ?? 0,
    odds: bet.odds ?? 0,
    status: bet.status,
    payout: bet.pointsAwarded,
  };
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
  let topSeedEntrantIds = new Set<string>();
  try {
    [sets, phases, topSeedEntrantIds] = await Promise.all([
      getUpcomingSets(tournament.eventSlug),
      getEventPhases(tournament.eventSlug),
      getEventTopSeedEntrantIds(tournament.eventSlug, 16).catch(() => new Set<string>()),
    ]);
  } catch (err) {
    error = err instanceof StartggApiError ? err.message : "Erreur inconnue.";
  }

  // Pour le bracket Top 8 (voir plus bas) : certains tournois scindent la
  // toute fin du bracket en plusieurs phases start.gg distinctes (ex. tout
  // le bracket 8 joueurs tagué "Top 24" côté start.gg, avec une phase
  // "Top 8" séparée ne contenant que la toute fin — confirmé sur CEO 2026,
  // où le bracket viewer start.gg affiche "Top 24" sur chaque match du
  // Top 8). On regroupe donc tous les sets de TOUTES les phases dont le nom
  // correspond à une étape tardive (voir isLateBracketRound, qui gère déjà
  // "Top N"/"Grand Final" en généralisant sur le nom plutôt que sur une
  // valeur figée), plutôt que de se limiter à la seule phase nommée
  // exactement "Top 8".
  //
  // getUpcomingSets ne renvoie que les matchs pas encore commencés/en cours
  // (state 1/2) — un match terminé disparaîtrait donc de l'arbre au fur et
  // à mesure du tournoi sans aller chercher les matchs terminés en plus,
  // seulement si au moins une de ces phases existe réellement pour cet
  // event, pour ne pas alourdir chaque chargement de page sans raison.
  const bracketPhaseIds = new Set(
    phases.filter((p) => isLateBracketRound(p.name, 24)).map((p) => p.id),
  );
  let completedTop8Sets: StartggSet[] = [];
  if (bracketPhaseIds.size > 0) {
    try {
      const completedSets = await getCompletedSets(tournament.eventSlug);
      completedTop8Sets = completedSets.filter(
        (s) => s.phaseId != null && bracketPhaseIds.has(s.phaseId),
      );
    } catch {
      // best-effort : le bracket se contente alors des matchs encore ouverts/en cours.
    }
  }

  const [userBets, currentUser] = await Promise.all([
    prisma.bet.findMany({ where: { userId: session.user.id, eventSlug: tournament.eventSlug } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { exBalance: true } }),
  ]);
  const betBySetId = new Map(userBets.map((bet) => [bet.setId, bet]));
  const exBalance = currentUser?.exBalance ?? 0;

  const phaseSections = buildPhaseSections(phases, sets);

  // Sidebar "Paris ouverts" : aperçu des matchs classiques réellement
  // pariables (state NOT_STARTED, deux entrants connus), sans avoir à
  // déplier round par round dans la liste principale. À partir du Top 24
  // (isNotableMatch via isLateBracketSet) : tous les matchs ouverts. Avant
  // le Top 24 (poules, Round 1/2/3...) : uniquement ceux impliquant un des
  // 16 meilleurs seeds du tournoi, qui restent intéressants à suivre.
  const openMatchEntries: OpenMatchEntry[] = sets
    .filter((set) => isSetOpenForBetting(set) && isNotableMatch(set, topSeedEntrantIds))
    .map((set) => ({
      set,
      entrants: buildEntrantsWithOdds(set),
      bet: buildExistingBet(betBySetId.get(set.id)),
    }));

  // Têtes de série affichées uniquement pour les poules identifiées — pas
  // pour chaque round d'un bracket classique, où ce serait redondant.
  const poolGroups = phaseSections
    .flatMap((s) => s.roundGroups)
    .filter((g) => g.phaseGroupId && g.sets.some((s) => s.poolLabel));
  // Une seule requête groupée (alias GraphQL) plutôt qu'une requête par
  // poule : une phase "Round 1" avec des dizaines de poules déclenchait
  // sinon autant de requêtes start.gg en parallèle à chaque chargement de
  // page, assez pour dépasser la limite de débit du token dès que plusieurs
  // parieurs chargeaient la page en même temps (ex. juste avant de placer un
  // pari, qui revérifie aussi l'état du match auprès de start.gg).
  const phaseGroupIds = [...new Set(poolGroups.map((g) => g.phaseGroupId!))];
  const seedsByPhaseGroup = await getPhaseGroupsTopSeeds(phaseGroupIds, 4).catch(
    () => new Map<string, StartggSeed[]>(),
  );

  // Une étape sans set généré côté start.gg n'a encore rien d'accessible (ni
  // pari possible, ni résultat) — l'afficher quand même comme "Pas encore
  // ouvert" n'apportait aucune information utile et encombrait la liste
  // avant les vraies phases en cours.
  const visiblePhaseSections = phaseSections.filter((phase) =>
    phase.roundGroups.some((g) => g.sets.length > 0),
  );

  // Vue en arbre (façon bracket start.gg) sous la liste des rounds : prend
  // les matchs ouverts/en cours (sets, filtrés par bracketPhaseIds) ET déjà
  // terminés (completedTop8Sets, récupéré séparément — voir plus haut) pour
  // garder l'arbre complet même une fois des matchs joués, plutôt que de les
  // voir disparaître au fur et à mesure. Indépendant de visiblePhaseSections
  // (qui masque les phases sans set "ouvert" — sans quoi l'arbre
  // disparaîtrait lui aussi une fois tous les matchs terminés).
  const bracketLayout =
    bracketPhaseIds.size > 0
      ? buildBracketLayout([
          ...sets.filter((s) => s.phaseId != null && bracketPhaseIds.has(s.phaseId)),
          ...completedTop8Sets,
        ])
      : null;

  return (
    <div className="flex gap-4 items-start">
      <OpenMatchesSidebar
        tournamentId={tournamentId}
        entries={openMatchEntries}
        exBalance={exBalance}
      />

      <div className="flex-1 min-w-0 flex flex-col gap-4">
      {error && (
        <div className="card p-4" style={{ color: "var(--lose)" }}>
          Impossible de récupérer les matchs depuis start.gg : {error}
        </div>
      )}

      {!error && phaseSections.length === 0 && (
        <p style={{ color: "var(--muted)" }}>Aucune étape disponible pour le moment.</p>
      )}

      {visiblePhaseSections.map((phase) => {
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
                {`${totalSets} match${totalSets > 1 ? "s" : ""}${openSets > 0 ? ` · ${openSets} ouvert${openSets > 1 ? "s" : ""}` : ""}`}
              </span>
            </summary>

            <div className="flex flex-col gap-3 p-4 pt-0">
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
                        const entrants = buildEntrantsWithOdds(set);
                        const bet = buildExistingBet(betBySetId.get(set.id));

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
                              locked={set.state !== SET_STATE.NOT_STARTED}
                              exBalance={exBalance}
                              existingBet={bet}
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

      {bracketLayout && (
        <Top8Bracket
          winners={bracketLayout.winners}
          grandFinal={bracketLayout.grandFinal}
          losers={bracketLayout.losers}
        />
      )}
      </div>
    </div>
  );
}
