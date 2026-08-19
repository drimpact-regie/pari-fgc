"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker (public/sw.js) côté client uniquement.
 * Requis pour que Chrome/Android propose "Ajouter à l'écran d'accueil"
 * (l'API PWA exige un SW avec un handler `fetch`) ; iOS Safari ignore ce
 * mécanisme et se base sur les balises apple-* dans layout.tsx à la place,
 * donc ce composant ne fait rien de visible sur iOS.
 *
 * Un échec d'enregistrement (navigateur trop vieux, mode privé, etc.) ne
 * doit jamais empêcher l'usage normal du site — d'où le catch silencieux.
 */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
