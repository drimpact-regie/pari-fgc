import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RegisterServiceWorker from "./register-sw";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Impact'O Bet",
  description: "Paris entre amis sur les brackets start.gg",
  // iOS Safari ne lit pas manifest.ts pour l'écran d'accueil : ces balises
  // apple-* sont ce qui déclenche réellement le mode standalone sur iOS.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Impact'O Bet",
  },
};

// themeColor/colorScheme vivent dans `viewport` (pas `metadata`) depuis
// Next 14 — sinon Next émet un avertissement de dépréciation au build.
export const viewport: Viewport = {
  themeColor: "#0B0E17",
};

/**
 * Racine minimale : le chrome du site (Nav, pied de page, conteneur
 * centré) vit dans app/(site)/layout.tsx, pas ici — pour que les pages
 * overlay OBS (app/overlay/...) puissent avoir leur propre mise en page
 * transparente sans hériter de la Nav/du fond opaque du site (voir
 * app/overlay/layout.tsx). Next.js n'autorise qu'un seul <html>/<body> par
 * arbre de routes ; c'est le rôle des groupes de routes "(site)" / "overlay"
 * de diverger en dessous de cette racine commune.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
