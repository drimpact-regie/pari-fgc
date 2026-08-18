/**
 * Badge "pays" pour les overlays OBS — un pastille avec le code pays
 * (ex. "US"), pas un emoji drapeau : OBS utilise Chromium embarqué (CEF),
 * dont le rendu des emoji drapeaux (séquences "regional indicator") dépend
 * de la police emoji du système et échoue silencieusement sur beaucoup
 * d'installations Windows (affiche les deux lettres brutes au lieu d'un
 * drapeau, sans style — repéré en conditions réelles). Ce badge rend la
 * même information de façon fiable sur toute plateforme, sans dépendre
 * d'aucune police emoji.
 */
export default function CountryBadge({
  countryCode,
  fontSize,
}: {
  countryCode: string;
  fontSize: string;
}) {
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
