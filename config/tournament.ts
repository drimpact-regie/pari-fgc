/**
 * Configuration liée aux tournois start.gg suivis par l'application.
 *
 * Les tournois sont gérés dynamiquement en base (table Tournament, ajoutés
 * depuis /admin/tournaments) — ne JAMAIS coder un slug de tournoi en dur
 * ailleurs dans le code. Les constantes ci-dessous ne servent qu'à amorcer
 * le tout premier tournoi au premier démarrage de l'app (voir
 * lib/tournaments.ts), quand la table Tournament est encore vide.
 *
 * Le slug d'event start.gg correspond à la partie d'URL après
 * "https://www.start.gg/" — par exemple pour
 * https://www.start.gg/tournament/ceo-2026/event/marvel-tokon-fighting-souls
 * le slug est "tournament/ceo-2026/event/marvel-tokon-fighting-souls".
 */

const DEFAULT_EVENT_SLUG =
  "tournament/ceo-2026/event/marvel-tokon-fighting-souls";

export const STARTGG_EVENT_SLUG =
  process.env.STARTGG_EVENT_SLUG?.trim() || DEFAULT_EVENT_SLUG;

/** Nom d'affichage du tournoi amorcé au premier démarrage. */
export const DEFAULT_TOURNAMENT_NAME =
  process.env.DEFAULT_TOURNAMENT_NAME?.trim() || "CEO 2026";

/** Nombre de places disponibles pour le cercle fermé de parieurs (phase 1). */
export const MAX_USERS = Number(process.env.MAX_USERS ?? 30);

/** Points attribués pour un pari gagnant. */
export const POINTS_PER_CORRECT_BET = Number(
  process.env.POINTS_PER_CORRECT_BET ?? 1,
);

/**
 * Durée (en secondes) pendant laquelle les réponses de l'API start.gg
 * (matchs à venir, stats joueurs) sont mises en cache côté serveur avant
 * d'être rafraîchies. Évite de saturer le rate-limit de l'API pour un
 * cercle de parieurs qui rafraîchit la page régulièrement.
 */
export const STARTGG_CACHE_SECONDS = Number(
  process.env.STARTGG_CACHE_SECONDS ?? 30,
);
