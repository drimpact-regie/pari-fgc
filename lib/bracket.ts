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

// Certains tournois taguent tout le bracket final sous une phase nommée
// "Top 24" même quand elle ne contient en réalité qu'un bracket 8 joueurs
// (confirmé sur CEO 2026) — l'appelant matche donc large sur le nom de
// phase plutôt que de se limiter à "Top 8" exactement. Filet de sécurité
// ici : si une phase matchée est réellement plus grande (vrai bracket 24
// joueurs), on ne garde que les rounds les plus proches de la grande
// finale de chaque côté, pour rester lisible plutôt que d'afficher un
// arbre démesuré.
const MAX_WINNERS_COLUMNS = 3;
const MAX_LOSERS_COLUMNS = 5;

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

  const winners = groupIntoColumns(winnersSets, (a, b) => a - b);
  const losers = groupIntoColumns(losersSets, (a, b) => b - a); // -1, -2, -3... (plus proche de 0 en premier)

  return {
    winners: winners.slice(Math.max(0, winners.length - MAX_WINNERS_COLUMNS)),
    // "Grand Final" avant "Grand Final Reset", peu importe leur round.
    grandFinal: groupIntoColumns(grandFinalSets, (a, b) => a - b),
    losers: losers.slice(Math.max(0, losers.length - MAX_LOSERS_COLUMNS)),
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
