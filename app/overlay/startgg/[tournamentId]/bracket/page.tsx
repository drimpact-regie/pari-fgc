import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Overlay OBS "bracket" pour un tournoi start.gg en mode régie — voir
 * app/overlay/startgg/[tournamentId]/match/page.tsx pour le même principe.
 */
export default async function StartggOverlayBracketPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const event = await prisma.invitationalEvent.findUnique({ where: { linkedTournamentId: tournamentId } });
  if (!event) notFound();

  redirect(`/overlay/invitational/${event.id}/bracket`);
}
