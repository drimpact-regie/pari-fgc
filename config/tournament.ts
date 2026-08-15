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

/** Points attribués pour un pari gagnant (paris "Top 8" et anciens paris sans score). */
export const POINTS_PER_CORRECT_BET = Number(
  process.env.POINTS_PER_CORRECT_BET ?? 1,
);

/**
 * Barème de points pour un pari "vainqueur + score exact" sur un match, avec
 * une logique de risk/reward façon cote sportive : parier sur l'outsider
 * (moins bien seedé) rapporte plus de points qu'un pari sur le favori, et
 * deviner le score exact (pas juste le vainqueur) ajoute un bonus.
 */
export const BET_POINTS = {
  /** Points de base pour un vainqueur correctement deviné (pari sur le favori). */
  base: POINTS_PER_CORRECT_BET,
  /** Écart de seed nécessaire entre les deux joueurs pour gagner 1 point bonus "outsider". */
  underdogSeedGapPerBonusPoint: 4,
  /** Plafond du bonus "outsider", quel que soit l'écart de seed. */
  underdogBonusCap: 4,
  /** Bonus si le score exact est deviné, selon le format du set (best of 3/5/7). */
  exactScoreBonusByBestOf: { 3: 2, 5: 3, 7: 4 } as Record<number, number>,
  /** Bonus de score exact par défaut quand le format du set est inconnu. */
  exactScoreBonusDefault: 2,
};

/**
 * Durée (en secondes) pendant laquelle les réponses de l'API start.gg
 * (matchs à venir, stats joueurs) sont mises en cache côté serveur avant
 * d'être rafraîchies. Évite de saturer le rate-limit de l'API pour un
 * cercle de parieurs qui rafraîchit la page régulièrement.
 */
export const STARTGG_CACHE_SECONDS = Number(
  process.env.STARTGG_CACHE_SECONDS ?? 30,
);
