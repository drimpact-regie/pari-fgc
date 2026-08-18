import type { InvitationalFormat } from "@prisma/client";

import type { InvitationalBracketMatch } from "./invitationalBracket";

/**
 * Gabarit de bracket "construit en dur" (voir Partie 2 du prompt overlay
 * bracket) : pas d'appel à l'API start.gg pour connaître la vraie
 * structure de qualification (coûteux en requêtes, et un event
 * Invitational n'a de toute façon aucune notion de round/lien de
 * qualification en base — voir lib/invitationalBracket.ts). À la place, la
 * TAILLE choisie par le prestataire (8/16/32, voir
 * InvitationalEvent.bracketSize) détermine un gabarit standard de
 * colonnes/cases, dans lequel les matchs déjà importés viennent se ranger
 * (voir buildTemplatedBracketColumns) — sans qu'aucune ligne du fichier
 * Excel n'ait besoin d'indiquer explicitement "round 1", "winners" etc :
 * seul l'ORDRE des groupes déjà présents (même logique que le groupement
 * existant par `groupLabel`, dans l'ordre de première apparition selon
 * `orderIndex`) importe.
 */

export const BRACKET_SIZES = [8, 16, 32] as const;
export type BracketSize = (typeof BRACKET_SIZES)[number];

export function isBracketSize(value: unknown): value is BracketSize {
  return typeof value === "number" && (BRACKET_SIZES as readonly number[]).includes(value);
}

export type BracketColumnSide = "winners" | "losers" | "final";

export interface BracketTemplateColumn {
  key: string;
  label: string;
  side: BracketColumnSide;
  matchSlots: number;
}

/** Nombre de matchs par round du camp des vainqueurs — ex. taille 8 → [4,2,1] (¼, ½, finale). */
function winnersRoundMatchCounts(size: BracketSize): number[] {
  const counts: number[] = [];
  for (let n = size / 2; n >= 1; n /= 2) counts.push(n);
  return counts;
}

/**
 * Nombre de matchs par round du camp des perdants, en double élimination —
 * structure standard : deux rounds à N matchs (l'un absorbe les perdants
 * du camp des vainqueurs, l'autre fait s'affronter les survivants entre
 * eux) avant de passer à N/2, jusqu'à la finale des perdants (1 match).
 * Ex. taille 8 → [2,2,1,1], taille 16 → [4,4,2,2,1,1].
 */
function losersRoundMatchCounts(size: BracketSize): number[] {
  const counts: number[] = [];
  for (let n = size / 4; n >= 1; n /= 2) counts.push(n, n);
  return counts;
}

/** Nom de round générique à partir du nombre de matchs qu'il contient (indépendant du camp). */
function baseRoundLabel(matchCount: number): string {
  switch (matchCount) {
    case 1:
      return "Final";
    case 2:
      return "Semi-Final";
    case 4:
      return "Quarter-Final";
    case 8:
      return "Round of 16";
    case 16:
      return "Round of 32";
    default:
      return `Round (${matchCount * 2} joueurs)`;
  }
}

/**
 * Gabarit de colonnes pour un format+taille donnés — voir Partie 2 du
 * prompt overlay bracket pour les libellés attendus ("Winners Semi-Final",
 * "Winners Final", "Grand Final", "Grand Final Reset" en double
 * élimination ; noms de round simples en simple élimination).
 */
export function getBracketTemplate(format: InvitationalFormat, size: BracketSize): BracketTemplateColumn[] {
  const isDouble = format === "BRACKET_DOUBLE";
  const columns: BracketTemplateColumn[] = [];

  winnersRoundMatchCounts(size).forEach((count, i) => {
    const label = !isDouble ? baseRoundLabel(count) : count === 1 ? "Winners Final" : `Winners ${baseRoundLabel(count)}`;
    columns.push({ key: `w${i}`, label, side: "winners", matchSlots: count });
  });

  if (isDouble) {
    const losersCounts = losersRoundMatchCounts(size);
    losersCounts.forEach((count, i) => {
      const isLast = i === losersCounts.length - 1;
      columns.push({ key: `l${i}`, label: isLast ? "Losers Final" : `Losers Round ${i + 1}`, side: "losers", matchSlots: count });
    });
    columns.push({ key: "gf", label: "Grand Final", side: "final", matchSlots: 1 });
    columns.push({ key: "gfr", label: "Grand Final Reset", side: "final", matchSlots: 1 });
  }

  return columns;
}

export interface TemplatedBracketColumn {
  key: string;
  label: string;
  side: BracketColumnSide;
  /** Un slot `null` = round pas encore atteint/importé — affiché comme case vide dans le gabarit. */
  matches: (InvitationalBracketMatch | null)[];
}

/**
 * Range les matchs déjà importés dans le gabarit — les matchs sont
 * regroupés par `groupLabel` dans l'ordre de première apparition (même
 * technique que buildInvitationalBracketColumns, voir lib/invitationalBracket.ts),
 * puis le groupe N vient remplir la colonne N du gabarit, ses matchs
 * (triés par `orderIndex`) remplissant les cases dans l'ordre. Un round pas
 * encore importé (aucun groupe correspondant) reste entièrement vide dans
 * le gabarit plutôt que de faire disparaître la colonne, pour que la
 * structure du bracket reste lisible dès le début de l'event.
 */
export function buildTemplatedBracketColumns(
  matches: InvitationalBracketMatch[],
  format: InvitationalFormat,
  size: BracketSize,
): TemplatedBracketColumn[] {
  const template = getBracketTemplate(format, size);
  const sorted = [...matches].sort((a, b) => a.orderIndex - b.orderIndex);

  const groups: InvitationalBracketMatch[][] = [];
  const groupByLabel = new Map<string, InvitationalBracketMatch[]>();
  for (const match of sorted) {
    const label = match.groupLabel?.trim() || "Matchs";
    let group = groupByLabel.get(label);
    if (!group) {
      group = [];
      groupByLabel.set(label, group);
      groups.push(group);
    }
    group.push(match);
  }

  return template.map((col, i) => {
    const group = groups[i] ?? [];
    const slotMatches: (InvitationalBracketMatch | null)[] = [];
    for (let slot = 0; slot < col.matchSlots; slot++) {
      slotMatches.push(group[slot] ?? null);
    }
    return { key: col.key, label: col.label, side: col.side, matches: slotMatches };
  });
}

/**
 * Position verticale (fraction 0..1) de chaque match de chaque round du
 * camp des vainqueurs (ou de tout le bracket en simple élimination,
 * puisqu'il n'y a alors qu'un seul camp) — algorithme standard de l'arbre
 * binaire d'un bracket : le round le plus large (les premiers matchs) est
 * espacé également, puis la position de chaque match d'un round suivant
 * est la MOYENNE des positions des deux matchs du round précédent dont il
 * découle (slot 2i et 2i+1) — c'est cette moyenne qui produit le tracé en
 * "chevrons" caractéristique d'un bracket, pas un simple espacement égal
 * par colonne (qui donnerait des lignes de connexion qui ne s'alignent
 * pas). Utilisé pour dessiner les lignes de connexion (voir
 * components/InvitationalBracket.tsx) ; ne s'applique pas au camp des
 * perdants (voir sa doc dans ce même composant).
 */
export function computeWinnersColumnYFractions(winnersMatchSlots: number[]): number[][] {
  const result: number[][] = [];
  let previous: number[] | null = null;

  for (const count of winnersMatchSlots) {
    const fractions: number[] = previous
      ? Array.from({ length: count }, (_, i) => (previous![2 * i] + previous![2 * i + 1]) / 2)
      : Array.from({ length: count }, (_, i) => (i + 0.5) / count);
    result.push(fractions);
    previous = fractions;
  }

  return result;
}
