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

  // Plus de padding/cadrage ici : OverlayMatchView couvre maintenant tout le
  // viewport (position: fixed; inset: 0) et positionne chaque élément en
  // pourcentage d'un repère fixe 1920x1080 (voir lib/invitationalOverlayLayout.ts)
  // — la Browser Source OBS doit être configurée à une résolution 16:9
  // (1920x1080 ou équivalent réduit, ex. 960x540) pour que les positions
  // tombent au bon endroit sur le fond personnalisé de l'event.
  return <OverlayMatchView eventId={eventId} />;
}
