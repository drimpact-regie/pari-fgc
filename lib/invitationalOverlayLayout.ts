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
  "scoreA",
  "nameB",
  "tagB",
  "flagB",
  "scoreB",
  "stage",
  "ft",
] as const;

export type OverlayElementKey = (typeof OVERLAY_ELEMENT_KEYS)[number];

export const OVERLAY_ELEMENT_LABELS: Record<OverlayElementKey, string> = {
  nameA: "Nom A",
  tagA: "Tag A",
  flagA: "Drapeau A",
  scoreA: "Score A",
  nameB: "Nom B",
  tagB: "Tag B",
  flagB: "Drapeau B",
  scoreB: "Score B",
  stage: "Étape",
  ft: "FT",
};

export interface OverlayPosition {
  x: number;
  y: number;
  /**
   * Taille de police en cqw (% de la largeur du cadre 16:9) — même unité que
   * le rendu réel (voir OverlayMatchView), donc directement comparable entre
   * l'aperçu et le stream. Chaque event/jeu a ses propres contraintes de
   * place dans son visuel : pas de taille universelle qui convienne à tous.
   */
  size: number;
}

export type OverlayLayout = Record<OverlayElementKey, OverlayPosition>;

export const OVERLAY_CANVAS_WIDTH = 1920;
export const OVERLAY_CANVAS_HEIGHT = 1080;

/**
 * Disposition par défaut si l'event n'a rien configuré (voir
 * mergeOverlayLayout) — joueur A à gauche, B à droite, étape/FT en haut,
 * repère absolu 1920x1080 pour que l'overlay reste utilisable sans
 * configuration. Score A/B positionnés à côté de leur joueur respectif (pas
 * un score combiné centré) : chaque prestataire a en général une zone
 * dédiée par joueur dans son propre visuel (ex. une forme colorée par
 * joueur) — à ajuster à cette zone précise via les positions ci-dessous.
 */
export const DEFAULT_OVERLAY_LAYOUT: OverlayLayout = {
  stage: { x: 700, y: 40, size: 1.6 },
  ft: { x: 700, y: 90, size: 1.3 },
  flagA: { x: 120, y: 160, size: 1.1 },
  nameA: { x: 180, y: 150, size: 1.7 },
  tagA: { x: 180, y: 195, size: 1.1 },
  scoreA: { x: 620, y: 150, size: 2 },
  flagB: { x: 1850, y: 160, size: 1.1 },
  nameB: { x: 1500, y: 150, size: 1.7 },
  tagB: { x: 1500, y: 195, size: 1.1 },
  scoreB: { x: 1430, y: 150, size: 2 },
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidXY(value: unknown): value is { x: number; y: number } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return isFiniteNumber(candidate.x) && isFiniteNumber(candidate.y);
}

/**
 * Complète un layout stocké (potentiellement partiel, ou totalement absent
 * — event pas encore configuré) avec les valeurs par défaut, élément par
 * élément, et même champ par champ à l'intérieur d'un élément : un layout
 * enregistré avant l'ajout du champ "size" (ou avec une valeur corrompue
 * pour ce seul champ) garde ses positions X/Y déjà réglées et récupère
 * juste la taille par défaut, sans réinitialiser tout l'élément — le JSON
 * stocké n'est pas validé au niveau de la base.
 */
export function mergeOverlayLayout(stored: unknown): OverlayLayout {
  const source = typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>) : {};
  const result = {} as OverlayLayout;
  for (const key of OVERLAY_ELEMENT_KEYS) {
    const candidate = source[key] as Record<string, unknown> | undefined;
    const xy = isValidXY(candidate) ? { x: candidate!.x as number, y: candidate!.y as number } : DEFAULT_OVERLAY_LAYOUT[key];
    const size = isFiniteNumber(candidate?.size) && candidate!.size > 0 ? (candidate!.size as number) : DEFAULT_OVERLAY_LAYOUT[key].size;
    result[key] = { x: xy.x, y: xy.y, size };
  }
  return result;
}
