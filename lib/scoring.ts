import { PARRY_POINTS } from "@/config/tournament";

/**
 * Ex "Le Pari du Parry" pour un joueur pronostiqué dans le Top 8, selon
 * son placement final réel (0 s'il n'a pas fini dans le top 8, ou si le
 * tournoi n'est pas encore terminé pour lui).
 */
export function computeTop8PickPoints(placement: number | null): number {
  if (placement == null) return 0;
  return PARRY_POINTS.top8ByPlacement[placement] ?? 0;
}

/** Ex MVC : nombre d'apparitions du personnage deviné exactement (pas de barème dégressif). */
export function computeMvcPoints(predictedCount: number, actualCount: number | null): number {
  if (actualCount == null) return 0;
  return predictedCount === actualCount ? PARRY_POINTS.mvcExact : 0;
}

/** Ex reset de bracket : pari oui/non correct. */
export function computeBracketResetPoints(
  predictedYes: boolean,
  actualYes: boolean | null,
): number {
  if (actualYes == null) return 0;
  return predictedYes === actualYes ? PARRY_POINTS.bracketReset : 0;
}
