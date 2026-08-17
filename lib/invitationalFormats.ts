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
