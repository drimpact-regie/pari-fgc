import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTwitchChannel } from "@/lib/normalize";

const updateSchema = z.object({
  status: z.enum(["ACTIVE", "PAST"]).optional(),
  twitchChannel: z.string().trim().max(100).optional(),
  activeChatMatchId: z.string().trim().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { eventId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const existing = await prisma.invitationalEvent.findUnique({ where: { id: eventId } });
  if (!existing) {
    return NextResponse.json({ error: "Event introuvable." }, { status: 404 });
  }

  const event = await prisma.invitationalEvent.update({
    where: { id: eventId },
    data: {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.twitchChannel !== undefined
        ? { twitchChannel: normalizeTwitchChannel(parsed.data.twitchChannel) || null }
        : {}),
      ...(parsed.data.activeChatMatchId !== undefined
        ? { activeChatMatchId: parsed.data.activeChatMatchId || null }
        : {}),
    },
  });

  return NextResponse.json({ event });
}

/**
 * Supprime un event Invitational/Prestataire, avec tout ce qui lui est
 * rattaché par relation (compétiteurs, matchs, paris — onDelete: Cascade
 * dans le schéma), contrairement aux tournois classiques dont les paris
 * sont rattachés par eventSlug et survivent à la suppression.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { eventId } = await params;
  const existing = await prisma.invitationalEvent.findUnique({ where: { id: eventId } });
  if (!existing) {
    return NextResponse.json({ error: "Event introuvable." }, { status: 404 });
  }

  await prisma.invitationalEvent.delete({ where: { id: eventId } });
  return NextResponse.json({ ok: true });
}
