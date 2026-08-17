import TransparentBody from "@/components/overlay/TransparentBody";

/**
 * Racine des pages overlay OBS (Browser Source) : pas de Nav, pas de pied
 * de page, pas de conteneur centré — juste le contenu de l'overlay, fond
 * transparent, en anticipation d'un fond de stream visible derrière.
 */
export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TransparentBody />
      {children}
    </>
  );
}
