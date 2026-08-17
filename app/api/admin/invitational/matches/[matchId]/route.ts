import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOrCreateEventCompetitor } from "@/lib/invitationalEvents";

const competitorSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  tag: z.string().trim().max(40).nullable().optional(),
  countryCode: z.string().trim().max(2).nullable().optional(),
});

const updateSchema = z.object({
  competitorA: competitorSchema.optional(),
  competitorB: competitorSchema.optional(),
  status: z.enum(["NOT_OPEN", "OPEN", "CLOSED", "COMPLETED"]).optional(),
});

/**
 * Édite les infos affichage (joueur/tag/pays) et le statut d'ouverture au
 * pari d'un match — jamais le vainqueur/score ici, uniquement via
 * POST .../result (voir lib/invitationalMatchResults.ts), pour que le seul
 * geste qui déclenche la résolution des paris reste sans ambiguïté.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { matchId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const match = await prisma.invitationalMatch.findUnique({ where: { id: matchId } });
  if (!match) {
    return NextResponse.json({ error: "Match introuvable." }, { status: 404 });
  }
  if (match.status === "COMPLETED") {
    return NextResponse.json(
      { error: "Ce match est déjà terminé, ses infos ne sont plus modifiables." },
      { status: 409 },
    );
  }

  // Slot "en attente" (voir InvitationalMatch.placeholderA/B) : le
  // renseigner pour la première fois crée ou réutilise un compétiteur de
  // l'event (findOrCreateEventCompetitor — réutilise le même compétiteur
  // que celui d'un match précédent s'il porte déjà ce nom, pour ne pas
  // scinder sa série de victoires) et efface le placeholder. Une fois le
  // compétiteur lié, les appels suivants éditent normalement son nom/tag/pays.
  const matchData: { competitorAId?: string; placeholderA?: null; competitorBId?: string; placeholderB?: null } = {};

  if (parsed.data.competitorA && match.competitorAId) {
    await prisma.invitationalCompetitor.update({
      where: { id: match.competitorAId },
      data: parsed.data.competitorA,
    });
  } else if (parsed.data.competitorA?.name) {
    const competitor = await findOrCreateEventCompetitor(match.eventId, {
      name: parsed.data.competitorA.name,
      tag: parsed.data.competitorA.tag ?? null,
      countryCode: parsed.data.competitorA.countryCode ?? null,
    });
    matchData.competitorAId = competitor.id;
    matchData.placeholderA = null;
  }

  if (parsed.data.competitorB && match.competitorBId) {
    await prisma.invitationalCompetitor.update({
      where: { id: match.competitorBId },
      data: parsed.data.competitorB,
    });
  } else if (parsed.data.competitorB?.name) {
    const competitor = await findOrCreateEventCompetitor(match.eventId, {
      name: parsed.data.competitorB.name,
      tag: parsed.data.competitorB.tag ?? null,
      countryCode: parsed.data.competitorB.countryCode ?? null,
    });
    matchData.competitorBId = competitor.id;
    matchData.placeholderB = null;
  }

  const updated = await prisma.invitationalMatch.update({
    where: { id: matchId },
    data: { ...matchData, ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}) },
    include: { competitorA: true, competitorB: true },
  });

  return NextResponse.json({ match: updated });
}
