"use client";

import { useState } from "react";

/**
 * Badge "pays" pour les overlays OBS — une vraie image de drapeau (SVG
 * auto-hébergé, voir public/flags/4x3/, extrait du paquet flag-icons), pas
 * un emoji drapeau : OBS utilise Chromium embarqué (CEF), dont le rendu des
 * emoji drapeaux (séquences "regional indicator") dépend de la police emoji
 * du système et échoue silencieusement sur beaucoup d'installations Windows
 * (affiche les deux lettres brutes au lieu d'un drapeau, sans style —
 * repéré en conditions réelles). Une image auto-hébergée s'affiche de façon
 * fiable sur toute plateforme, sans dépendre d'aucune police.
 *
 * Repli sur un badge texte si le code n'a pas de drapeau correspondant
 * (code invalide, ou "XX" utilisé comme aperçu générique dans l'éditeur
 * admin/partenaire).
 */
export default function CountryBadge({
  countryCode,
  fontSize,
}: {
  countryCode: string;
  fontSize: string;
}) {
  const code = countryCode.trim().toLowerCase();
  const [failed, setFailed] = useState(false);

  if (failed || !/^[a-z]{2}$/.test(code)) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.15em 0.5em",
          borderRadius: "0.3em",
          background: "rgba(255,255,255,0.16)",
          border: "1px solid rgba(255,255,255,0.4)",
          fontSize,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "0.03em",
          lineHeight: 1.4,
        }}
      >
        {countryCode.toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- asset local (public/flags), pas d'optimisation next/image nécessaire pour un overlay OBS.
    <img
      src={`/flags/4x3/${code}.svg`}
      alt={countryCode.toUpperCase()}
      onError={() => setFailed(true)}
      style={{
        display: "inline-block",
        height: `calc(${fontSize} * 1.5)`,
        width: `calc(${fontSize} * 2)`,
        objectFit: "cover",
        borderRadius: "0.15em",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.6)",
        verticalAlign: "middle",
      }}
    />
  );
}
