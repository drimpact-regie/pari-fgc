import OverlayBracketView from "@/components/overlay/OverlayBracketView";

export const dynamic = "force-dynamic";

/**
 * Overlay OBS "bracket / classement + prochains matchs" — à ajouter comme
 * Browser Source (fond transparent). Affiche l'arbre du bracket (formats
 * BRACKET_SINGLE/DOUBLE) ou un classement + liste de matchs (autres
 * formats), plus les 4 prochains matchs avec estimation d'horaire — voir
 * components/overlay/OverlayBracketView.tsx.
 */
export default async function OverlayBracketPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return <OverlayBracketView eventId={eventId} />;
}
