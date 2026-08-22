import type { InvitationalEvent, InvitationalFormat } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getCompletedSets,
  getEventPhases,
  getUpcomingSets,
  StartggApiError,
  type StartggPhase,
  type StartggSet,
} from "@/lib/startgg";
import {
  createInvitationalEvent,
  importMatchesIntoInvitationalEvent,
  type InvitationalImportSummary,
} from "@/lib/invitationalEvents";
import { InvitationalImportError, type ParsedInvitationalImport, type ParsedMatch } from "@/lib/invitationalImport";

export class RegieError extends Error {}

/**
 * Format Invitational équivalent d'un bracketType start.gg. "LIST" en repli
 * pour tout format non reconnu (round robin/swiss couverts explicitement,
 * le reste — CUSTOM_SCHEDULE, exhibition...) : reste utilisable via les vues
 * non-bracket déjà prévues côté Invitational (classement + liste de
 * matchs), voir Partie 1 du prompt "Mode régie". Valeurs de l'enum
 * start.gg non vérifiées contre l'API réelle depuis cet environnement (pas
 * d'accès réseau sortant) ; à confirmer sur la première activation.
 */
export function mapBracketTypeToInvitationalFormat(bracketType: string | null): InvitationalFormat {
  switch (bracketType) {
    case "SINGLE_ELIMINATION":
      return "BRACKET_SINGLE";
    case "DOUBLE_ELIMINATION":
      return "BRACKET_DOUBLE";
    case "ROUND_ROBIN":
      return "ROUND_ROBIN";
    case "SWISS":
      return "SWISS";
    default:
      return "LIST";
  }
}

/**
 * La dernière phase renvoyée par start.gg est presque toujours le bracket
 * final (poules puis bracket, dans l'ordre renvoyé par l'API) — heuristique
 * non vérifiée en conditions réelles depuis cet environnement (pas d'accès
 * réseau sortant), à confirmer sur la première activation.
 */
export function pickRegiePhase(phases: StartggPhase[]): StartggPhase | null {
  return phases.length > 0 ? phases[phases.length - 1] : null;
}

/** Groupe des sets par round (voir convention start.gg documentée dans lib/bracket.ts), triés selon `compareRounds`. */
function bucketByRound(
  sets: StartggSet[],
  compareRounds: (a: number, b: number) => number,
): StartggSet[][] {
  const byRound = new Map<number, StartggSet[]>();
  for (const set of sets) {
    if (!byRound.has(set.round)) byRound.set(set.round, []);
    byRound.get(set.round)!.push(set);
  }
  return Array.from(byRound.entries())
    .sort(([a], [b]) => compareRounds(a, b))
    .map(([, roundSets]) => roundSets);
}

function setToParsedMatch(set: StartggSet, orderIndex: number): ParsedMatch {
  const slotA = set.slots[0] ?? null;
  const slotB = set.slots[1] ?? null;
  const label = set.fullRoundText || null;
  return {
    groupLabel: label,
    orderIndex,
    competitorA: slotA?.entrant ? { name: slotA.entrant.name, tag: null, countryCode: null } : null,
    placeholderA: !slotA?.entrant ? `À déterminer (${label ?? "round suivant"})` : null,
    competitorB: slotB?.entrant ? { name: slotB.entrant.name, tag: null, countryCode: null } : null,
    placeholderB: !slotB?.entrant ? `À déterminer (${label ?? "round suivant"})` : null,
    ftGames: set.totalGames,
    roundsPerGame: null,
    verifManette: null,
    startggSetId: set.id,
  };
}

/**
 * Construit les lignes d'import (même forme qu'un import Excel, voir
 * lib/invitationalImport.ts) à partir des sets déjà récupérés d'UNE phase
 * start.gg — même ordre que le gabarit de bracket (lib/invitationalBracketTemplate.ts) :
 * rounds winners croissants, puis rounds losers croissants (double
 * élimination uniquement), puis Grand Final, puis Grand Final Reset. C'est
 * cet ordre d'apparition des groupLabel qui permet au gabarit de ranger
 * chaque round dans la bonne colonne (voir buildTemplatedBracketColumns) —
 * peu importe le texte exact du libellé.
 *
 * N'importe que la STRUCTURE (compétiteurs déjà connus, ou "à déterminer"
 * sinon) : un match déjà terminé côté start.gg au moment de l'activation
 * n'est pas importé avec son score/vainqueur (aucun champ prévu pour ça
 * dans le format d'import partagé avec l'Excel) — à ressaisir manuellement
 * si le mode régie est activé en cours de tournoi plutôt qu'avant son
 * lancement.
 */
export function buildRegieMatchesFromSets(sets: StartggSet[]): ParsedMatch[] {
  const grandFinalSets = sets.filter((s) => /grand final/i.test(s.fullRoundText));
  const grandFinalResetSets = grandFinalSets.filter((s) => /reset/i.test(s.fullRoundText));
  const grandFinalOnlySets = grandFinalSets.filter((s) => !/reset/i.test(s.fullRoundText));
  const grandFinalIds = new Set(grandFinalSets.map((s) => s.id));

  const winnersSets = sets.filter((s) => !grandFinalIds.has(s.id) && s.round > 0);
  const losersSets = sets.filter((s) => !grandFinalIds.has(s.id) && s.round < 0);

  const winnersBuckets = bucketByRound(winnersSets, (a, b) => a - b);
  const losersBuckets = bucketByRound(losersSets, (a, b) => b - a); // -1, -2, -3... (plus proche de 0 en premier)

  const orderedBuckets = [...winnersBuckets, ...losersBuckets];
  if (grandFinalOnlySets.length > 0) orderedBuckets.push(grandFinalOnlySets);
  if (grandFinalResetSets.length > 0) orderedBuckets.push(grandFinalResetSets);

  // Index global (pas remis à zéro à chaque round) : buildInvitationalBracketColumns
  // trie TOUS les matchs par orderIndex pour déterminer l'ordre d'apparition
  // des colonnes (voir lib/invitationalBracket.ts) — un index local par
  // round produisait des doublons entre rounds (round 1 match 0, round 2
  // match 0...), rendant cet ordre non déterministe côté SQL (colonnes
  // affichées dans un ordre arbitraire plutôt que Round 1 → Grand Final).
  let globalIndex = 0;
  return orderedBuckets.flatMap((bucketSets) => bucketSets.map((set) => setToParsedMatch(set, globalIndex++)));
}

async function fetchPhaseSets(eventSlug: string, phaseId: string): Promise<StartggSet[]> {
  const [upcoming, completed] = await Promise.all([
    getUpcomingSets(eventSlug),
    getCompletedSets(eventSlug),
  ]);
  return [...upcoming, ...completed].filter((s) => s.phaseId === phaseId);
}

async function buildRegieImport(eventSlug: string): Promise<ParsedInvitationalImport> {
  let phases: StartggPhase[];
  try {
    phases = await getEventPhases(eventSlug);
  } catch (err) {
    throw new RegieError(
      err instanceof StartggApiError ? err.message : "Impossible de contacter start.gg.",
    );
  }

  const phase = pickRegiePhase(phases);
  if (!phase) {
    throw new RegieError("Aucune étape trouvée côté start.gg pour ce tournoi.");
  }

  let sets: StartggSet[];
  try {
    sets = await fetchPhaseSets(eventSlug, phase.id);
  } catch (err) {
    throw new RegieError(
      err instanceof StartggApiError ? err.message : "Impossible de contacter start.gg.",
    );
  }

  if (sets.length === 0) {
    throw new RegieError(
      `Aucun match généré côté start.gg pour l'étape "${phase.name}" (dernière étape de l'event, celle importée par le mode régie). ` +
        `Si une étape précédente (poules, qualifications...) n'est pas encore terminée, le bracket final n'a probablement pas encore été seedé — ` +
        `réessaie une fois cette étape terminée et le bracket réellement généré sur start.gg.`,
    );
  }

  return {
    format: mapBracketTypeToInvitationalFormat(phase.bracketType),
    matches: buildRegieMatchesFromSets(sets),
  };
}

/**
 * Active le mode régie pour un tournoi start.gg : import figé (un seul
 * appel API, pas de polling) dans une InvitationalEvent dédiée, liée au
 * Tournament via linkedTournamentId — voir prisma/schema.prisma. Toute la
 * gestion ultérieure (édition de match, désignation "actif overlay",
 * overlays OBS) réutilise ensuite tel quel l'outillage Invitational déjà
 * construit, sans rien dupliquer.
 */
export async function activateTournamentRegie(tournamentId: string): Promise<InvitationalEvent> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { regieEvent: true },
  });
  if (!tournament) throw new RegieError("Tournoi introuvable.");
  if (tournament.regieEvent) throw new RegieError("Le mode régie est déjà actif pour ce tournoi.");

  const parsed = await buildRegieImport(tournament.eventSlug);

  // twitchChannel volontairement laissé vide : les paris chat restent sur
  // l'économie/le canal du Tournament lui-même (voir doc du champ
  // InvitationalEvent.linkedTournamentId), pas sur cette coquille interne.
  try {
    return await createInvitationalEvent({
      name: tournament.name,
      eventDate: new Date(),
      parsed,
      linkedTournamentId: tournament.id,
    });
  } catch (err) {
    // Erreur DB inattendue (ex. activation en double quasi-simultanée) —
    // reformulée en RegieError pour que la vraie cause remonte jusqu'à
    // l'admin plutôt que le message générique de la route API.
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    throw new RegieError(`Échec de la création de l'event régie : ${message}`);
  }
}

/**
 * Resynchronise le mode régie depuis start.gg : même logique de fusion que
 * le réimport Excel Invitational (voir importMatchesIntoInvitationalEvent)
 * — un match déjà en cours/joué n'est jamais écrasé ; un match pas encore
 * joué est resynchronisé (nom/tag d'un joueur, y compris un DQ qui change
 * l'entrant d'un match futur). Si start.gg a changé de format entre-temps
 * (rare), l'event garde son format d'origine — le déclarer explicitement
 * est un geste admin, pas une resync automatique (même règle que le
 * réimport Excel self-service).
 */
export async function resyncTournamentRegie(tournamentId: string): Promise<InvitationalImportSummary> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { regieEvent: true },
  });
  if (!tournament) throw new RegieError("Tournoi introuvable.");
  if (!tournament.regieEvent) throw new RegieError("Le mode régie n'est pas actif pour ce tournoi.");

  const parsed = await buildRegieImport(tournament.eventSlug);
  try {
    return await importMatchesIntoInvitationalEvent(tournament.regieEvent.id, tournament.regieEvent.format, parsed);
  } catch (err) {
    // Le format détecté côté start.gg a changé depuis l'activation (rare) —
    // importMatchesIntoInvitationalEvent bloque plutôt que de basculer
    // silencieusement le format d'un event déjà en cours (même règle que le
    // réimport Excel self-service) ; message reformulé, celui d'origine
    // parle de "fichier" (contexte Excel, pas régie start.gg).
    if (err instanceof InvitationalImportError) {
      throw new RegieError(
        `Le format détecté côté start.gg (${parsed.format}) ne correspond plus au format du mode régie ` +
          `(${tournament.regieEvent.format}) — changement de format non pris en charge par la resync, contacte un admin.`,
      );
    }
    throw err;
  }
}
