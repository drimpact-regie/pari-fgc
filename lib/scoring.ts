import { BET_POINTS } from "@/config/tournament";

export interface BetScoringInput {
  /** Le vainqueur pronostiqué est-il le vrai vainqueur du match ? */
  won: boolean;
  /** Tête de série du joueur pronostiqué vainqueur (snapshot au moment du pari). */
  predictedEntrantSeed: number | null;
  /** Tête de série de son adversaire (snapshot au moment du pari). */
  opponentSeed: number | null;
  /** Format du set (Bo3 = 3, Bo5 = 5, ...), snapshot au moment du pari. */
  totalGames: number | null;
  predictedEntrantScore: number | null;
  predictedOpponentScore: number | null;
  /** Manches gagnées par le vrai vainqueur du match, une fois terminé. */
  actualWinnerScore: number | null;
  /** Manches gagnées par le perdant du match, une fois terminé. */
  actualLoserScore: number | null;
}

/**
 * Calcule les points d'un pari "vainqueur + score exact" : rien si le
 * vainqueur pronostiqué est faux, sinon des points de base plus un bonus
 * "outsider" si le joueur pronostiqué était moins bien seedé que son
 * adversaire (risk/reward, comme une cote), plus un bonus si le score exact
 * a aussi été deviné.
 */
export function computeBetPoints({
  won,
  predictedEntrantSeed,
  opponentSeed,
  totalGames,
  predictedEntrantScore,
  predictedOpponentScore,
  actualWinnerScore,
  actualLoserScore,
}: BetScoringInput): number {
  if (!won) return 0;

  let points = BET_POINTS.base;

  // Seed plus grand = moins bien classé = outsider. Plus l'écart est grand,
  // plus le pari était risqué, plus le bonus est élevé (plafonné).
  if (
    predictedEntrantSeed != null &&
    opponentSeed != null &&
    predictedEntrantSeed > opponentSeed
  ) {
    const gap = predictedEntrantSeed - opponentSeed;
    const underdogBonus = Math.min(
      Math.floor(gap / BET_POINTS.underdogSeedGapPerBonusPoint),
      BET_POINTS.underdogBonusCap,
    );
    points += underdogBonus;
  }

  const guessedExactScore =
    predictedEntrantScore != null &&
    predictedOpponentScore != null &&
    actualWinnerScore != null &&
    actualLoserScore != null &&
    predictedEntrantScore === actualWinnerScore &&
    predictedOpponentScore === actualLoserScore;

  if (guessedExactScore) {
    const exactScoreBonus =
      (totalGames != null ? BET_POINTS.exactScoreBonusByBestOf[totalGames] : undefined) ??
      BET_POINTS.exactScoreBonusDefault;
    points += exactScoreBonus;
  }

  return points;
}
