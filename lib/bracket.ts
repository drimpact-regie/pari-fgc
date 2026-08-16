import type { StartggSet } from "@/lib/startgg";

export interface BracketColumn {
  label: string;
  sets: StartggSet[];
}

export interface BracketLayout {
  winners: BracketColumn[];
  grandFinal: BracketColumn[];
  losers: BracketColumn[];
}

/**
 * Regroupe les sets d'une phase à élimination directe (typiquement le Top 8)
 * en colonnes pour un affichage en arbre façon bracket start.gg : côté
 * winners (round positif), grande finale (repérée par fullRoundText plutôt
 * que par round, sa numérotation de round n'étant pas fiable d'un tournoi à
 * l'autre), et côté losers (round négatif).
 *
 * Convention start.gg : `set.round` est positif pour le bracket winners
 * (1, 2, 3...) et négatif pour le bracket losers (-1, -2, -3...), la valeur
 * absolue croissante avec l'avancement — plus négatif = plus tardif. Cette
 * convention est un standard de longue date de l'API start.gg mais n'a pas
 * pu être vérifiée contre des données réelles depuis cet environnement (pas
 * d'accès réseau) ; à confirmer une fois déployé.
 */
export function buildBracketLayout(sets: StartggSet[]): BracketLayout {
  const grandFinalSets = sets.filter((s) => /grand final/i.test(s.fullRoundText));
  const grandFinalIds = new Set(grandFinalSets.map((s) => s.id));

  const winnersSets = sets.filter((s) => !grandFinalIds.has(s.id) && s.round > 0);
  const losersSets = sets.filter((s) => !grandFinalIds.has(s.id) && s.round < 0);

  return {
    winners: groupIntoColumns(winnersSets, (a, b) => a - b),
    // "Grand Final" avant "Grand Final Reset", peu importe leur round.
    grandFinal: groupIntoColumns(grandFinalSets, (a, b) => a - b),
    losers: groupIntoColumns(losersSets, (a, b) => b - a), // -1, -2, -3... (plus proche de 0 en premier)
  };
}

function groupIntoColumns(
  sets: StartggSet[],
  compareRounds: (a: number, b: number) => number,
): BracketColumn[] {
  const byRound = new Map<number, StartggSet[]>();
  for (const set of sets) {
    if (!byRound.has(set.round)) byRound.set(set.round, []);
    byRound.get(set.round)!.push(set);
  }

  return Array.from(byRound.entries())
    .sort(([a], [b]) => compareRounds(a, b))
    .map(([, roundSets]) => ({
      label: roundSets[0]?.fullRoundText || "Round",
      sets: roundSets,
    }));
}
