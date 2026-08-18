/**
 * Validation du fond d'overlay personnalisé (voir
 * InvitationalEvent.overlayBackgroundUrl) : stocké tel quel comme data: URL
 * PNG (pas de traitement d'image côté serveur — aucune lib de décodage
 * image n'est installée dans le projet, donc pas de vérification serveur
 * des dimensions réelles ; la page d'édition avertit côté client via
 * Image() si le fichier choisi n'est pas 1920x1080, en best-effort).
 */

export const MAX_OVERLAY_BACKGROUND_BASE64_LENGTH = 6_000_000; // ~4.4 Mo décodés

export class InvitationalOverlayImageError extends Error {}

/**
 * Valide qu'une valeur est bien une data: URL PNG de taille raisonnable, ou
 * une chaîne vide (= suppression du fond personnalisé, retour au défaut).
 * Lève InvitationalOverlayImageError sinon, avec un message actionnable.
 */
export function assertValidOverlayBackgroundDataUrl(value: string): void {
  if (value === "") return;

  if (!value.startsWith("data:image/png;base64,")) {
    throw new InvitationalOverlayImageError("Le fond doit être une image PNG.");
  }
  if (value.length > MAX_OVERLAY_BACKGROUND_BASE64_LENGTH) {
    throw new InvitationalOverlayImageError("Image trop volumineuse (4 Mo max).");
  }
}
