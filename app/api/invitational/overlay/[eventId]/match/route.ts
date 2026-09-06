import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { mergeOverlayLayout } from "@/lib/invitationalOverlayLayout";

/**
 * Endpoint public en lecture seule pour l'overlay OBS "match en cours"
 * (/overlay/invitational/[eventId]/match) — sondé par polling côté client,
 * pas d'authentification (OBS Browser Source ne peut pas se connecter).
 * Renvoie le match désigné via InvitationalEvent.activeOverlayMatchId (voir
 * Partie 1 du prompt overlay), ou `match: null` si aucun n'est désigné.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  const event = await prisma.invitationalEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event introuvable." }, { status: 404 });
  }

  if (!event.activeOverlayMatchId) {
    return NextResponse.json({ match: null });
  }

  const match = await prisma.invitationalMatch.findUnique({
    where: { id: event.activeOverlayMatchId },
    include: { competitorA: true, competitorB: true },
  });

  if (!match || match.eventId !== eventId) {
    return NextResponse.json({ match: null });
  }

  const competitorA = match.competitorA
    ? {
        name: match.competitorA.name,
        tag: match.competitorA.tag,
        countryCode: match.competitorA.countryCode,
        score: match.scoreA,
      }
    : match.placeholderA
      ? { name: match.placeholderA, tag: null, countryCode: null, score: null, placeholder: true }
      : null;
  const competitorB = match.competitorB
    ? {
        name: match.competitorB.name,
        tag: match.competitorB.tag,
        countryCode: match.competitorB.countryCode,
        score: match.scoreB,
      }
    : match.placeholderB
      ? { name: match.placeholderB, tag: null, countryCode: null, score: null, placeholder: true }
      : null;

  // Inversion J1/J2 (voir InvitationalEvent.activeOverlayMatchSwapped) : les
  // joueurs s'installent parfois à l'inverse de ce qui était prévu — on
  // échange simplement les deux côtés ici, l'overlay lui-même (positions
  // nameA/nameB...) n'a besoin d'aucune logique supplémentaire.
  const swapped = event.activeOverlayMatchSwapped;

  return NextResponse.json({
    overlayBackgroundUrl: event.overlayBackgroundUrl,
    overlayLayout: mergeOverlayLayout(event.overlayLayout),
    match: {
      id: match.id,
      groupLabel: match.groupLabel,
      status: match.status,
      ftGames: match.ftGames,
      competitorA: swapped ? competitorB : competitorA,
      competitorB: swapped ? competitorA : competitorB,
    },
  });
}
