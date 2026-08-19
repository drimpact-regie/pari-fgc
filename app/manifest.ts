import type { MetadataRoute } from "next";

/**
 * Manifeste PWA — permet "Ajouter à l'écran d'accueil" (Android/desktop
 * Chrome) et une installation quasi-native (iOS Safari lit surtout les
 * balises <meta apple-*> ajoutées dans app/layout.tsx, mais recense aussi
 * ce fichier). Next.js sert automatiquement ceci sur /manifest.webmanifest
 * et ajoute le <link rel="manifest"> correspondant — rien d'autre à
 * brancher à la main.
 *
 * Icônes : placeholder généré à partir des couleurs de marque relevées
 * sur le PowerPoint de présentation (fond #0B0E17, accent doré #EAC35C).
 * À remplacer par le vrai logo dès qu'il est livré par l'artiste — il
 * suffit d'écraser les fichiers dans public/icons/ (mêmes noms, mêmes
 * tailles) et app/icon.png / app/apple-icon.png, sans toucher ce fichier.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Impact'O Bet",
    short_name: "Impact'O Bet",
    description:
      "Plateforme de paris communautaire pour tournois et events Twitch",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0E17",
    theme_color: "#0B0E17",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
