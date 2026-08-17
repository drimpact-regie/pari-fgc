import type { InvitationalFormat } from "@prisma/client";

/**
 * Modèles Excel prêts à remplir, un par format (voir
 * docs/invitational-import-format.md pour la structure attendue) — servis
 * au prestataire depuis sa page de gestion self-service (voir
 * app/api/partner/invitational/events/[eventId]/template/route.ts).
 */
export const INVITATIONAL_TEMPLATE_FILENAMES: Record<InvitationalFormat, string> = {
  BRACKET_SINGLE: "bracket-simple.xlsx",
  BRACKET_DOUBLE: "bracket-double.xlsx",
  ROUND_ROBIN: "round-robin.xlsx",
  SWISS: "swiss.xlsx",
  POOLS: "poules.xlsx",
  LIST: "liste.xlsx",
};
