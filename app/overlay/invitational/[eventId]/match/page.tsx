import OverlayMatchView from "@/components/overlay/OverlayMatchView";

export const dynamic = "force-dynamic";

/**
 * Overlay OBS "match en cours" — à ajouter comme Browser Source (fond
 * transparent). Affiche le match désigné par l'admin comme "actif overlay"
 * pour cet event (voir /admin/invitational/[eventId]), avec rafraîchissement
 * automatique en arrière-plan (voir components/overlay/OverlayMatchView.tsx).
 */
export default async function OverlayMatchPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  // Contenu ancré en haut à gauche, pas centré dans un plein écran : la
  // taille réelle de la Browser Source OBS est choisie par le prestataire
  // (voir la légende dans /admin/invitational/[eventId]) et le cadrage doit
  // rester prévisible quelle que soit cette taille — un contenu centré dans
  // un conteneur plein écran se retrouve invisible/coupé si la Browser
  // Source est plus petite que l'écran ou recadrée en supposant un contenu
  // en haut à gauche.
  return (
    <div className="p-4">
      <OverlayMatchView eventId={eventId} />
    </div>
  );
}
