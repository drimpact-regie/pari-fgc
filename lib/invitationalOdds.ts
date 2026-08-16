import {
  INVITATIONAL_BASE_ODDS,
  INVITATIONAL_ODDS_CEIL,
  INVITATIONAL_ODDS_FLOOR,
  INVITATIONAL_ODDS_STEP,
} from "@/config/invitational";

export interface StreakOdds {
  oddsA: number;
  oddsB: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Cote décimale de chaque compétiteur d'un match invitational, à partir de
 * leur série de victoires consécutives EN COURS dans ce même event
 * (InvitationalCompetitor.currentStreak — 0 si le compétiteur vient de
 * perdre ou n'a pas encore joué). Contrairement aux tournois classiques
 * (lib/odds.ts), pas de seed : la cote ne dépend que de la forme récente
 * dans cet event précis.
 *
 * Formule : écart de série (streakA - streakB) × 0.10, retiré à la cote de
 * base du favori et ajouté en miroir à celle de l'outsider, chaque côté
 * borné indépendamment (plancher 1.25 pour le favori, plafond 3.00 pour
 * l'outsider) — donc pas de compensation stricte one-for-one une fois qu'un
 * des deux plafonds/planchers est atteint, par choix de simplicité plutôt
 * que de recalculer l'autre côté en fonction de l'écrêtage du premier.
 *
 * Sans série des deux côtés (streakA = streakB = 0, ou séries égales), les
 * deux cotes valent exactement INVITATIONAL_BASE_ODDS (1.90/1.90).
 */
export function computeStreakOdds(streakA: number, streakB: number): StreakOdds {
  const delta = (streakA - streakB) * INVITATIONAL_ODDS_STEP;
  const oddsA = clamp(
    round2(INVITATIONAL_BASE_ODDS - delta),
    INVITATIONAL_ODDS_FLOOR,
    INVITATIONAL_ODDS_CEIL,
  );
  const oddsB = clamp(
    round2(INVITATIONAL_BASE_ODDS + delta),
    INVITATIONAL_ODDS_FLOOR,
    INVITATIONAL_ODDS_CEIL,
  );
  return { oddsA, oddsB };
}
