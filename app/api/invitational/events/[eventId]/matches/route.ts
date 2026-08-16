import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * Endpoint public en lecture seule, exposant l'état structuré des matchs
 * d'un event Invitational/Prestataire — en anticipation d'un futur overlay
 * stream (OBS browser source), pas encore construit (voir Partie 3 du
 * prompt d'origine : la structure doit juste être prête). Pas
 * d'authentification requise (même logique qu'un lecteur Twitch intégré :
 * données qui finissent de toute façon affichées à l'écran), mais
 * strictement scopé à un seul event, en lecture seule.
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

  const matches = await prisma.invitationalMatch.findMany({
    where: { eventId },
    include: { competitorA: true, competitorB: true, winner: true },
    orderBy: [{ groupLabel: "asc" }, { orderIndex: "asc" }],
  });

  return NextResponse.json({
    event: { id: event.id, name: event.name, eventDate: event.eventDate, format: event.format },
    matches: matches.map((m) => ({
      id: m.id,
      groupLabel: m.groupLabel,
      orderIndex: m.orderIndex,
      status: m.status,
      competitorA: m.competitorA
        ? { id: m.competitorA.id, name: m.competitorA.name, tag: m.competitorA.tag, countryCode: m.competitorA.countryCode }
        : null,
      competitorB: m.competitorB
        ? { id: m.competitorB.id, name: m.competitorB.name, tag: m.competitorB.tag, countryCode: m.competitorB.countryCode }
        : null,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winnerId: m.winnerId,
    })),
  });
}
