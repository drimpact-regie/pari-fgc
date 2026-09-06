/**
 * Schémas Zod partagés pour valider les layouts d'overlay Invitational
 * (positions/tailles/couleurs), utilisés à la fois par la route PATCH d'un
 * event (app/api/admin/invitational/events/[eventId]/route.ts) et par les
 * routes de presets réutilisables (app/api/admin/invitational/overlay-presets).
 *
 * Un champ non déclaré ici est silencieusement supprimé par zod au parsing
 * (déjà rencontré une fois avec le champ "size") — toujours étendre ici
 * avant d'ajouter un nouveau champ à OverlayPosition.
 */
import { z } from "zod";

import { OVERLAY_ELEMENT_KEYS } from "./invitationalOverlayLayout";
import { BRACKET_OVERLAY_ELEMENT_KEYS } from "./invitationalBracketOverlayLayout";

export const overlayPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  size: z.number().positive().optional(),
  // Couleur du texte (éléments "Étape"/"Tag" uniquement, voir
  // OVERLAY_COLOR_ELEMENT_KEYS) — format #rrggbb, celui produit par un
  // <input type="color">.
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const overlayLayoutSchema = z.object(
  Object.fromEntries(OVERLAY_ELEMENT_KEYS.map((key) => [key, overlayPositionSchema.optional()])),
);

export const bracketOverlayLayoutSchema = z.object(
  Object.fromEntries(BRACKET_OVERLAY_ELEMENT_KEYS.map((key) => [key, overlayPositionSchema.optional()])),
);
