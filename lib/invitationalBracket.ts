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
