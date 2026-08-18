/**
 * Positions des éléments de l'overlay OBS "match en cours" — chaque jeu a
 * ses propres zones de HUD à des endroits différents sur l'image de fond du
 * prestataire (voir InvitationalEvent.overlayBackgroundUrl), donc pas de
 * position universelle : chaque event stocke ses propres coordonnées (voir
 * InvitationalEvent.overlayLayout, un JSON libre en base — ce module est le
 * seul endroit qui connaît sa forme attendue et sait la valider/compléter).
 *
 * Repère fixe 1920x1080 (résolution du fond attendue) quel que soit la
 * taille réelle de la Browser Source OBS — voir OverlayMatchView, qui
 * convertit ces coordonnées en pourcentages pour un rendu responsive.
 */

export const OVERLAY_ELEMENT_KEYS = [
  "nameA",
  "tagA",
  "flagA",
  "nameB",
  "tagB",
  "flagB",
  "score",
  "stage",
  "ft",
] as const;

export type OverlayElementKey = (typeof OVERLAY_ELEMENT_KEYS)[number];

export const OVERLAY_ELEMENT_LABELS: Record<OverlayElementKey, string> = {
  nameA: "Nom A",
  tagA: "Tag A",
  flagA: "Drapeau A",
  nameB: "Nom B",
  tagB: "Tag B",
  flagB: "Drapeau B",
  score: "Score",
  stage: "Étape",
  ft: "FT",
};

export interface OverlayPosition {
  x: number;
  y: number;
}

export type OverlayLayout = Record<OverlayElementKey, OverlayPosition>;

export const OVERLAY_CANVAS_WIDTH = 1920;
export const OVERLAY_CANVAS_HEIGHT = 1080;

/**
 * Disposition par défaut si l'event n'a rien configuré (voir
 * mergeOverlayLayout) — reprend approximativement l'agencement de la
 * version "carte" précédente (joueur A à gauche, B à droite, score au
 * centre, étape/FT au-dessus), mais en repère absolu 1920x1080 pour que
 * l'overlay reste utilisable sans configuration.
 */
export const DEFAULT_OVERLAY_LAYOUT: OverlayLayout = {
  stage: { x: 760, y: 60 },
  ft: { x: 1060, y: 68 },
  flagA: { x: 120, y: 160 },
  nameA: { x: 180, y: 150 },
  tagA: { x: 180, y: 195 },
  score: { x: 900, y: 150 },
  flagB: { x: 1700, y: 160 },
  nameB: { x: 1640, y: 150 },
  tagB: { x: 1640, y: 195 },
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidPosition(value: unknown): value is OverlayPosition {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return isFiniteNumber(candidate.x) && isFiniteNumber(candidate.y);
}

/**
 * Complète un layout stocké (potentiellement partiel, ou totalement absent
 * — event pas encore configuré) avec les valeurs par défaut, élément par
 * élément. Tolérant à une valeur invalide/corrompue pour un seul élément
 * (retombe sur le défaut de CET élément uniquement, sans faire échouer tout
 * l'overlay) — le JSON stocké n'est pas validé au niveau de la base.
 */
export function mergeOverlayLayout(stored: unknown): OverlayLayout {
  const source = typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>) : {};
  const result = {} as OverlayLayout;
  for (const key of OVERLAY_ELEMENT_KEYS) {
    const candidate = source[key];
    result[key] = isValidPosition(candidate) ? { x: candidate.x, y: candidate.y } : DEFAULT_OVERLAY_LAYOUT[key];
  }
  return result;
}
