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

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <OverlayMatchView eventId={eventId} />
    </div>
  );
}
