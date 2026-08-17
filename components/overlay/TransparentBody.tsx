"use client";

import { useEffect } from "react";

/**
 * Les pages overlay OBS doivent avoir un fond réellement transparent pour
 * qu'une Browser Source OBS affiche le stream en dessous plutôt qu'un
 * rectangle opaque. globals.css fixe un fond opaque sur <body> pour le
 * reste du site (voir app/(site)/layout.tsx) — on l'écrase ici directement
 * en DOM plutôt que par une règle CSS supplémentaire, pour ne dépendre
 * d'aucune spécificité de sélecteur.
 */
export default function TransparentBody() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.background;
    const prevBodyBg = body.style.background;
    html.style.background = "transparent";
    body.style.background = "transparent";
    return () => {
      html.style.background = prevHtmlBg;
      body.style.background = prevBodyBg;
    };
  }, []);

  return null;
}
