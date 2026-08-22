import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Overlay OBS "match en cours" pour un tournoi start.gg en mode régie —
 * URL scopée au tournoi (celle que connaît déjà le régisseur) plutôt qu'à
 * l'InvitationalEvent interne qu'il ne voit jamais. Redirige vers l'overlay
 * Invitational existant, réutilisé tel quel (voir InvitationalEvent.linkedTournamentId).
 */
export default async function StartggOverlayMatchPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const event = await prisma.invitationalEvent.findUnique({ where: { linkedTournamentId: tournamentId } });
  if (!event) notFound();

  redirect(`/overlay/invitational/${event.id}/match`);
}
