/**
 * Positions des encadrés de l'overlay OBS "bracket/classement" — pour les
 * formats sans structure de bracket (ROUND_ROBIN, SWISS, POOLS, LIST), où
 * l'overlay affiche un classement et une liste de matchs plutôt qu'un arbre
 * (voir components/overlay/OverlayBracketView.tsx). Même principe que
 * lib/invitationalOverlayLayout.ts ("match en cours") : repère fixe
 * 1920x1080, chaque event stocke ses propres coordonnées (voir
 * InvitationalEvent.bracketOverlayLayout).
 */

import { mergePositionedLayout, OVERLAY_CANVAS_HEIGHT, OVERLAY_CANVAS_WIDTH, type OverlayPosition } from "./invitationalOverlayCanvas";

export { OVERLAY_CANVAS_WIDTH, OVERLAY_CANVAS_HEIGHT, type OverlayPosition };

export const BRACKET_OVERLAY_ELEMENT_KEYS = ["standings", "matchList", "bracket"] as const;

export type BracketOverlayElementKey = (typeof BRACKET_OVERLAY_ELEMENT_KEYS)[number];

export const BRACKET_OVERLAY_ELEMENT_LABELS: Record<BracketOverlayElementKey, string> = {
  standings: "Classement",
  matchList: "Liste de matchs",
  // Position + échelle de l'arbre de bracket entier (formats BRACKET_SINGLE/
  // BRACKET_DOUBLE) — "standings"/"matchList" ne s'appliquent qu'aux formats
  // sans structure de bracket, voir components/overlay/OverlayBracketView.tsx.
  bracket: "Bracket (arbre)",
};

export type BracketOverlayLayout = Record<BracketOverlayElementKey, OverlayPosition>;

/**
 * Disposition par défaut : classement à gauche, liste de matchs à droite,
 * sous la zone de titre — repère absolu 1920x1080. `size` est un facteur
 * d'échelle (1 = taille d'origine) appliqué à tout l'encadré (voir
 * OverlayBracketView), pas une taille de police isolée : ces encadrés sont
 * des tableaux à plusieurs lignes, une échelle uniforme est plus simple à
 * régler qu'une police par élément interne.
 */
export const DEFAULT_BRACKET_OVERLAY_LAYOUT: BracketOverlayLayout = {
  standings: { x: 80, y: 260, size: 1 },
  matchList: { x: 700, y: 260, size: 1 },
  bracket: { x: 40, y: 160, size: 1 },
};

/**
 * Complète un layout stocké (potentiellement partiel, ou totalement absent
 * — event pas encore configuré) avec les valeurs par défaut, élément par
 * élément, et même champ par champ à l'intérieur d'un élément (voir
 * mergePositionedLayout) — le JSON stocké n'est pas validé au niveau de la
 * base.
 */
export function mergeBracketOverlayLayout(stored: unknown): BracketOverlayLayout {
  return mergePositionedLayout(BRACKET_OVERLAY_ELEMENT_KEYS, DEFAULT_BRACKET_OVERLAY_LAYOUT, stored);
}
