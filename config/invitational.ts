/**
 * Configuration du système de cote dynamique des events Invitational /
 * Prestataire (showmatchs, weeklies, exhibitions sans existence côté
 * start.gg) — voir lib/invitationalOdds.ts.
 */

/** Cote de chaque compétiteur à l'ouverture d'un match sans historique de série dans l'event. */
export const INVITATIONAL_BASE_ODDS = 1.9;

/** Ajustement de cote par victoire consécutive au sein du même event (voir computeStreakOdds). */
export const INVITATIONAL_ODDS_STEP = 0.1;

/** Cote minimale pour le compétiteur en série de victoires (le favori ne descend jamais en dessous). */
export const INVITATIONAL_ODDS_FLOOR = 1.25;

/** Cote maximale pour l'adversaire d'un compétiteur en série (l'outsider ne monte jamais au-dessus). */
export const INVITATIONAL_ODDS_CEIL = 3.0;
