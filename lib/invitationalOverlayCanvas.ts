/**
 * Repère commun à tous les overlays OBS Invitational/Prestataire (match en
 * cours, bracket/classement) : positions stockées dans un plan fixe
 * 1920x1080 quelle que soit la taille réelle de la Browser Source OBS — les
 * composants overlay convertissent en pourcentages/cqw pour un rendu
 * responsive (voir components/overlay/OverlayMatchView.tsx et
 * components/overlay/OverlayBracketView.tsx).
 */
export const OVERLAY_CANVAS_WIDTH = 1920;
export const OVERLAY_CANVAS_HEIGHT = 1080;

export interface OverlayPosition {
  x: number;
  y: number;
  /**
   * Taille (police en cqw, ou facteur d'échelle selon l'élément) — même
   * unité que le rendu réel, donc directement comparable entre l'aperçu et
   * le stream. Chaque event a ses propres contraintes de place : pas de
   * taille universelle qui convienne à tous.
   */
  size: number;
  /**
   * Couleur du texte de cet élément (ex. "#fbbf24"), au format hexadécimal
   * #rrggbb — optionnel : seuls les éléments de texte configurables (étape,
   * tag) l'utilisent réellement au rendu (voir OverlayMatchView.tsx),
   * les autres l'ignorent silencieusement. Absent = valeur par défaut
   * (voir DEFAULT_OVERLAY_LAYOUT), pour rester compatible avec les layouts
   * enregistrés avant l'ajout de ce champ.
   */
  color?: string;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidXY(value: unknown): value is { x: number; y: number } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return isFiniteNumber(candidate.x) && isFiniteNumber(candidate.y);
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value);
}

/**
 * Complète un layout stocké (potentiellement partiel, ou totalement absent
 * — event pas encore configuré) avec les valeurs par défaut, élément par
 * élément, et même champ par champ à l'intérieur d'un élément : un layout
 * enregistré avant l'ajout du champ "size" (ou avec une valeur corrompue
 * pour ce seul champ) garde ses positions X/Y déjà réglées et récupère
 * juste la taille par défaut, sans réinitialiser tout l'élément — le JSON
 * stocké n'est pas validé au niveau de la base. Factorisé entre
 * lib/invitationalOverlayLayout.ts ("match en cours") et
 * lib/invitationalBracketOverlayLayout.ts ("bracket/classement"), qui ne
 * diffèrent que par leur jeu de clés/valeurs par défaut.
 */
export function mergePositionedLayout<K extends string>(
  keys: readonly K[],
  defaults: Record<K, OverlayPosition>,
  stored: unknown,
): Record<K, OverlayPosition> {
  const source = typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>) : {};
  const result = {} as Record<K, OverlayPosition>;
  for (const key of keys) {
    const candidate = source[key] as Record<string, unknown> | undefined;
    const xy = isValidXY(candidate) ? { x: candidate!.x as number, y: candidate!.y as number } : defaults[key];
    const size = isFiniteNumber(candidate?.size) && candidate!.size > 0 ? (candidate!.size as number) : defaults[key].size;
    const color = isValidHexColor(candidate?.color) ? (candidate!.color as string) : defaults[key].color;
    result[key] = { x: xy.x, y: xy.y, size, ...(color ? { color } : {}) };
  }
  return result;
}
