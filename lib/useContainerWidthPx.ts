"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Mesure en JS la largeur réelle (px) d'un conteneur, pour calculer soi-même
 * une taille de police "en % de la largeur du conteneur" plutôt que de
 * s'appuyer sur l'unité CSS `cqw` (container query units) : OBS affiche les
 * Browser Sources via un Chromium embarqué (CEF) dont la version suit celle
 * d'OBS Studio installée par le streamer — potentiellement ancienne — et les
 * container queries (~Chromium 105, 2022) n'y sont pas garanties disponibles.
 *
 * Ref de callback (pas `useRef` + `useEffect([])`) : le conteneur mesuré
 * n'apparaît dans le DOM qu'une fois le match chargé (état asynchrone) côté
 * overlay OBS, potentiellement plusieurs rendus après le montage initial du
 * composant — un effet à dépendances vides ne se redéclenche pas à ce
 * moment-là et ne verrait jamais le conteneur (ref.current resterait null
 * indéfiniment). Une ref de callback, elle, est invoquée par React à chaque
 * fois que le nœud DOM sous-jacent apparaît ou change, quel que soit le
 * rendu qui le produit.
 */
export function useContainerWidthPx<T extends HTMLElement>(): [(node: T | null) => void, number | null] {
  const [width, setWidth] = useState<number | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;

    setWidth(node.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    observerRef.current = observer;
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
