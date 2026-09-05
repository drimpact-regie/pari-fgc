import type { InvitationalEvent, InvitationalFormat } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getCompletedSets,
  getEventPhases,
  getUpcomingSetsIncludingPreviews,
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

export interface RegiePhaseSets {
  phase: StartggPhase;
  sets: StartggSet[];
}

/**
 * Combine TOUTES les étapes start.gg d'un event (poules puis bracket, ou un
 * bracket scindé en plusieurs étapes de taille décroissante) en une seule
 * liste de matchs pour le mode régie — plutôt que la seule dernière étape
 * (l'ancien comportement se limitait de fait au bracket final, "Top 8" côté
 * utilisateur). `buildRegieMatchesFromSets` se réutilise tel quel par étape
 * (et par poule, voir ci-dessous) : son filtre "grand final"/round négatif
 * ne matche jamais rien pour une étape de poules (ROUND_ROBIN/SWISS), qui se
 * réduit alors naturellement à un simple tri par round croissant — pas
 * besoin d'une fonction séparée.
 *
 * À l'intérieur d'une même étape, plusieurs poules PARALLÈLES peuvent
 * partager le même `phaseId` (ex. "Bracket" scindé en "Pool D1"/"Pool D2",
 * chacune son propre bracket indépendant jusqu'à un cutoff commun vers
 * l'étape suivante — voir StartggSet.poolLabel) : sans les séparer, leurs
 * rounds (round=1, "Winners Round 1"...) se confondraient en un seul groupe
 * mélangeant les deux poules. Les sets d'une même étape sont donc d'abord
 * éclatés par poolLabel (dans l'ordre de première apparition) avant d'être
 * passés à buildRegieMatchesFromSets, puis recombinés.
 *
 * Les libellés de round sont préfixés par le nom de l'étape UNIQUEMENT s'il
 * y a plusieurs étapes avec des matchs, et par la poule UNIQUEMENT s'il y en
 * a plusieurs au sein d'une étape (sinon comportement inchangé) — pour
 * distinguer par exemple "Poules — Round 1" de "Bracket — Round 1", ou
 * "Poule D1 — Winners Round 1" de "Poule D2 — Winners Round 1".
 */
export function buildRegieMatchesFromPhases(phasesWithSets: RegiePhaseSets[]): ParsedMatch[] {
  const withMatches = phasesWithSets.filter((p) => p.sets.length > 0);
  const multiplePhases = withMatches.length > 1;

  let globalIndex = 0;
  const allMatches: ParsedMatch[] = [];
  for (const { phase, sets } of withMatches) {
    const poolLabels = Array.from(
      new Set(sets.map((s) => s.poolLabel).filter((label): label is string => Boolean(label))),
    );
    const multiplePools = poolLabels.length > 1;
    const poolBuckets = multiplePools
      ? [
          ...poolLabels.map((label) => ({ label, sets: sets.filter((s) => s.poolLabel === label) })),
          // Un set d'étape sans poule (ex. une éventuelle Grand Final commune
          // aux poules) ne doit pas disparaître silencieusement.
          ...(sets.some((s) => !s.poolLabel) ? [{ label: null, sets: sets.filter((s) => !s.poolLabel) }] : []),
        ]
      : [{ label: null as string | null, sets }];

    for (const { label: poolLabel, sets: poolSets } of poolBuckets) {
      for (const match of buildRegieMatchesFromSets(poolSets)) {
        const prefixParts = [multiplePhases ? phase.name : null, poolLabel ? `Poule ${poolLabel}` : null].filter(
          (part): part is string => Boolean(part),
        );
        allMatches.push({
          ...match,
          orderIndex: globalIndex++,
          groupLabel:
            prefixParts.length > 0 && match.groupLabel
              ? `${prefixParts.join(" — ")} — ${match.groupLabel}`
              : match.groupLabel,
        });
      }
    }
  }
  return allMatches;
}

/**
 * Format Invitational de l'ensemble : celui de l'étape si une seule a des
 * matchs (comportement inchangé), sinon celui partagé si toutes les étapes
 * avec des matchs sont du même type start.gg (ex. un bracket scindé en
 * plusieurs étapes DOUBLE_ELIMINATION reste un vrai bracket unique) — et
 * "LIST" en repli dès que les types diffèrent (poules + bracket) : aucun
 * rendu "arbre" unique n'a de sens pour un mélange des deux, mais la liste
 * de matchs, le classement chronologique et la désignation du match actif à
 * l'overlay restent, eux, disponibles quel que soit le format.
 *
 * Si AUCUNE étape n'a encore de match généré (activation avant le début du
 * tournoi, voir buildRegieImport ci-dessous qui l'autorise désormais), on se
 * base plutôt sur TOUTES les étapes déclarées — le bracketType d'une étape
 * est connu côté start.gg dès sa création, avant même que ses matchs soient
 * seedés. Sans ça, un event activé à l'avance retombait systématiquement sur
 * "LIST" par défaut, et resynchroniser une fois le tournoi réellement lancé
 * (où le vrai format serait alors détecté) échouait : un changement de
 * format sur un event déjà actif est refusé par importMatchesIntoInvitationalEvent.
 */
export function regieOverallFormat(phasesWithSets: RegiePhaseSets[]): InvitationalFormat {
  const withMatches = phasesWithSets.filter((p) => p.sets.length > 0);
  const relevantPhases = withMatches.length > 0 ? withMatches : phasesWithSets;
  const bracketTypes = new Set(relevantPhases.map((p) => p.phase.bracketType));
  if (bracketTypes.size === 1) {
    return mapBracketTypeToInvitationalFormat(relevantPhases[0].phase.bracketType);
  }
  return "LIST";
}

/**
 * Message remonté au régisseur quand un appel start.gg échoue pendant
 * l'import régie — distingue le 429 (limite de débit atteinte MALGRÉ les
 * tentatives déjà effectuées par callStartGG, voir lib/startgg.ts) d'une
 * vraie panne : dans ce cas précis, la bonne réponse est de réessayer dans
 * quelques instants, pas de traiter ça comme une erreur définitive. Diagnostic
 * du 429 rencontré ici : cet import n'est PAS un seul appel réseau malgré la
 * description produit ("un seul appel API") — getEventPhases() puis
 * getUpcomingSets()/getCompletedSets() (chacune paginée jusqu'à 5 pages, voir
 * fetchAllPages) peuvent totaliser jusqu'à une dizaine de requêtes HTTP pour
 * un gros tournoi, ce qui suffit à épuiser un budget de débit déjà entamé
 * par ailleurs (page Matchs ouverte sur ce tournoi, cron de résolution...).
 */
export function regieStartggErrorMessage(err: unknown): string {
  if (err instanceof StartggApiError) {
    if (err.status === 429) {
      return (
        "start.gg a temporairement limité les appels (trop de requêtes), malgré plusieurs tentatives " +
        "automatiques déjà effectuées — patiente quelques secondes puis clique de nouveau sur " +
        '"Activer le mode régie".'
      );
    }
    return err.message;
  }
  return "Impossible de contacter start.gg.";
}

async function buildRegieImport(eventSlug: string): Promise<ParsedInvitationalImport> {
  let phases: StartggPhase[];
  try {
    phases = await getEventPhases(eventSlug);
  } catch (err) {
    throw new RegieError(regieStartggErrorMessage(err));
  }

  if (phases.length === 0) {
    throw new RegieError("Aucune étape trouvée côté start.gg pour ce tournoi.");
  }

  let allSets: StartggSet[];
  try {
    // Séquentiel plutôt que Promise.all : ce sont déjà deux requêtes
    // paginées (jusqu'à 5 pages chacune) qui tournent chacune en interne de
    // façon séquentielle — les lancer en plus l'une contre l'autre en
    // parallèle ne fait que doubler la pointe de requêtes simultanées
    // envoyées à start.gg pour un import qui n'est de toute façon pas
    // sensible au temps (action ponctuelle d'activation, pas un chargement
    // de page utilisateur).
    // ...IncludingPreviews (pas getUpcomingSets) : tant que l'organisateur
    // n'a pas lancé le bracket sur start.gg, TOUS ses sets — y compris un
    // Round 1 déjà entièrement seedé — sont renvoyés en "preview_", qui
    // sinon disparaissent silencieusement de l'import régie (voir la
    // documentation de getUpcomingSetsIncludingPreviews).
    const upcoming = await getUpcomingSetsIncludingPreviews(eventSlug);
    const completed = await getCompletedSets(eventSlug);
    allSets = [...upcoming, ...completed];
  } catch (err) {
    throw new RegieError(regieStartggErrorMessage(err));
  }

  const phasesWithSets: RegiePhaseSets[] = phases.map((phase) => ({
    phase,
    sets: allSets.filter((s) => s.phaseId === phase.id),
  }));

  // Un tournoi pas encore démarré (aucun match seedé sur aucune étape) est
  // volontairement accepté plutôt que rejeté : le régisseur peut vouloir
  // activer le mode régie à l'avance (chaîne Twitch, réglages d'overlay...)
  // puis resynchroniser une fois le bracket réellement généré sur start.gg —
  // createInvitationalEvent gère déjà un event "coquille" sans matchs (voir
  // aussi createEmptyInvitationalEvent, même principe côté self-service).
  return {
    format: regieOverallFormat(phasesWithSets),
    matches: buildRegieMatchesFromPhases(phasesWithSets),
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
