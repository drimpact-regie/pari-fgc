"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mesure en JS la largeur réelle (px) d'un conteneur, pour calculer soi-même
 * une taille de police "en % de la largeur du conteneur" plutôt que de
 * s'appuyer sur l'unité CSS `cqw` (container query units) : OBS affiche les
 * Browser Sources via un Chromium embarqué (CEF) dont la version suit celle
 * d'OBS Studio installée par le streamer — potentiellement ancienne — et les
 * container queries (~Chromium 105, 2022) n'y sont pas garanties disponibles.
 * Repéré en conditions réelles : tailles de police configurées différentes
 * (ex. tagA plus petit que nameA) mais rendu à l'identique en stream, alors
 * que l'aperçu admin (navigateur à jour) affichait bien la différence — signe
 * d'un repli silencieux du `cqw` non supporté plutôt qu'un bug de données.
 * `ResizeObserver` est lui supporté bien plus largement (bien avant les
 * container queries), donc un calcul manuel en px est fiable partout.
 */
export function useContainerWidthPx<T extends HTMLElement>(): [React.RefObject<T | null>, number | null] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    setWidth(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/**
 * Convertit une taille stockée en "unité cqw" (1 = 1% de la largeur du
 * conteneur) en une chaîne CSS px à partir d'une largeur mesurée en JS —
 * avec repli sur `cqw` tant que la largeur n'a pas encore été mesurée (un
 * seul rendu, le temps que ResizeObserver rapporte sa première mesure).
 */
export function cqwToPx(size: number, containerWidthPx: number | null): string {
  return containerWidthPx != null ? `${(containerWidthPx * size) / 100}px` : `${size}cqw`;
}
