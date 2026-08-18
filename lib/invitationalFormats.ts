import type { InvitationalFormat } from "@prisma/client";

/** Libellés d'affichage partagés entre le formulaire de demande, l'admin et la page partenaire. */
export const INVITATIONAL_FORMAT_LABELS: Record<InvitationalFormat, string> = {
  BRACKET_SINGLE: "Bracket simple élimination",
  BRACKET_DOUBLE: "Bracket double élimination",
  ROUND_ROBIN: "Round robin",
  SWISS: "Suisse",
  POOLS: "Poules",
  LIST: "Liste de matchs",
};

export const INVITATIONAL_FORMATS = Object.keys(INVITATIONAL_FORMAT_LABELS) as InvitationalFormat[];

/** Formats avec une structure de bracket (arbre visuel sur l'overlay) — les autres affichent classement + liste de matchs. */
export const INVITATIONAL_BRACKET_FORMATS = new Set<InvitationalFormat>(["BRACKET_SINGLE", "BRACKET_DOUBLE"]);

export function isInvitationalBracketFormat(format: InvitationalFormat): boolean {
  return INVITATIONAL_BRACKET_FORMATS.has(format);
}
