/**
 * Construit la disposition en colonnes d'un bracket Invitational/Prestataire
 * (BRACKET_SINGLE ou BRACKET_DOUBLE) pour l'overlay
 * /overlay/invitational/[eventId]/bracket — voir components/InvitationalBracket.tsx.
 *
 * Contrairement aux tournois classiques (lib/bracket.ts, qui exploite la
 * convention de round start.gg et les prereq de sets), un event invitational
 * n'a aucune notion de round numérique ni de lien "ce match alimente tel
 * autre" : seul un texte libre (`groupLabel`) et un ordre global
 * (`orderIndex`) existent. On regroupe donc simplement les matchs par
 * `groupLabel`, dans l'ordre où ce libellé apparaît pour la première fois en
 * suivant `orderIndex` — approximation suffisante pour un bracket standard
 * (les rounds sont naturellement saisis dans l'ordre chronologique par
 * l'admin/l'import), sans prétendre reconstruire les vraies relations de
 * qualification entre matchs.
 */

export interface InvitationalBracketMatch {
  id: string;
  groupLabel: string | null;
  orderIndex: number;
  competitorA: { name: string; tag: string | null; countryCode: string | null } | null;
  placeholderA: string | null;
  competitorB: { name: string; tag: string | null; countryCode: string | null } | null;
  placeholderB: string | null;
  status: "NOT_OPEN" | "OPEN" | "CLOSED" | "COMPLETED";
  winnerId: string | null;
  competitorAId: string | null;
  competitorBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
}

export interface BracketColumn {
  label: string;
  matches: InvitationalBracketMatch[];
}

/**
 * Déduit le camp (vainqueurs/perdants) d'un round à partir de son libellé —
 * un event "legacy" (voir components/InvitationalBracket.tsx) n'a pas de
 * `side` connu à l'avance, mais pour le mode régie (lib/tournamentRegie.ts),
 * le libellé EST le vrai nom de round start.gg ("Winners Round 1", "Losers
 * Round 2", "Grand Final"...), qui suffit à classer sans configuration
 * supplémentaire. "Grand Final"/"Grand Final Reset" tombent côté "winners"
 * (convention : affichés à la suite du camp des vainqueurs, voir
 * components/InvitationalBracket.tsx).
 */
export function classifyRoundSide(label: string): "losers" | "winners" {
  return /^losers?\b/i.test(label.trim()) ? "losers" : "winners";
}

/**
 * Séparateur utilisé par lib/tournamentRegie.ts (buildRegieMatchesFromPhases)
 * pour préfixer un `groupLabel` par sa section ("Poule D1", "Poule D2",
 * "Top 8"...) quand un event régie couvre plusieurs poules/phases — partagé
 * ici pour que l'admin (regroupement des lignes) et l'overlay (abréviation
 * de l'étape affichée en stream) parsent exactement la même convention.
 */
export const SECTION_SEPARATOR = " — ";

export function splitSection(label: string): { section: string | null; roundLabel: string } {
  const idx = label.indexOf(SECTION_SEPARATOR);
  if (idx === -1) return { section: null, roundLabel: label };
  return { section: label.slice(0, idx), roundLabel: label.slice(idx + SECTION_SEPARATOR.length) };
}

/**
 * Abrège un nom de round start.gg ("Winners Round 1" -> "WR1", "Grand Final
 * Reset" -> "GFR"...) : initiales des mots (le tiret de "Semi-Final" compte
 * comme une séparation de mot) suivies du numéro final s'il y en a un.
 */
function abbreviateRoundLabel(roundLabel: string): string {
  const trailingNumberMatch = roundLabel.match(/\s(\d+)$/);
  const trailingNumber = trailingNumberMatch ? trailingNumberMatch[1] : "";
  const withoutNumber = trailingNumberMatch ? roundLabel.slice(0, trailingNumberMatch.index) : roundLabel;
  const initials = withoutNumber
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return initials + trailingNumber || roundLabel;
}

/**
 * Libellé d'étape affiché sur l'overlay stream : n'abrège QUE la partie
 * round d'un `groupLabel` préfixé par une section (mode régie multi-poules,
 * ex. "Poule D2 — Winners Round 1" -> "Poule D2 - WR1"), pour tenir sur une
 * ligne sans déborder. Un `groupLabel` simple, sans section (l'immense
 * majorité des events invitational "classiques"), reste affiché tel quel —
 * seul le cas multi-poules produisait des libellés assez longs pour poser
 * problème en stream.
 */
export function abbreviateStageLabel(fullLabel: string): string {
  const { section, roundLabel } = splitSection(fullLabel);
  if (!section) return fullLabel;
  return `${section} - ${abbreviateRoundLabel(roundLabel)}`;
}

export function buildInvitationalBracketColumns(matches: InvitationalBracketMatch[]): BracketColumn[] {
  const sorted = [...matches].sort((a, b) => a.orderIndex - b.orderIndex);

  const columns: BracketColumn[] = [];
  const columnByLabel = new Map<string, BracketColumn>();

  for (const match of sorted) {
    const label = match.groupLabel?.trim() || "Matchs";
    let column = columnByLabel.get(label);
    if (!column) {
      column = { label, matches: [] };
      columnByLabel.set(label, column);
      columns.push(column);
    }
    column.matches.push(match);
  }

  return columns;
}
