import { FALLBACK_ODDS } from "@/config/tournament";

export interface MatchOdds {
  oddsA: number;
  oddsB: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Cote décimale de chaque joueur d'un match, calculée par une simple règle
 * de trois à partir de leurs seeds start.gg (produit en croix) : plus le
 * seed est petit (mieux classé), plus la cote est basse. Propriété notable
 * de cette formule : 1/oddsA + 1/oddsB = 1 exactement avant arrondi (pas de
 * marge/pas de "banque" à équilibrer — le gain est toujours payé
 * directement, jamais depuis un pool commun, voir lib/matchResults.ts).
 *
 * Repli à FALLBACK_ODDS (50/50) si un seed est manquant, égal entre les
 * deux joueurs, ou invalide (<= 0, qui provoquerait une division par zéro).
 */
export function computeMatchOdds(seedA: number | null, seedB: number | null): MatchOdds {
  if (seedA == null || seedB == null || seedA <= 0 || seedB <= 0 || seedA === seedB) {
    return { oddsA: FALLBACK_ODDS, oddsB: FALLBACK_ODDS };
  }
  const sum = seedA + seedB;
  return { oddsA: round2(sum / seedB), oddsB: round2(sum / seedA) };
}

export interface MatchBetPayoutInput {
  won: boolean;
  stake: number;
  odds: number;
}

/**
 * Gain total en Ex si le pari est gagnant (mise × cote), arrondi à l'entier
 * le plus proche — 0 si perdant. La mise elle-même n'est pas ré-ajoutée ici
 * : elle a déjà été débitée du solde au moment du pari (voir /api/bets), ce
 * gain est donc le montant total à créditer, pas le gain net.
 */
export function computeMatchBetPayout({ won, stake, odds }: MatchBetPayoutInput): number {
  if (!won) return 0;
  return Math.round(stake * odds);
}
