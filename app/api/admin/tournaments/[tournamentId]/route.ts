import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTwitchChannel } from "@/lib/normalize";

const updateSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80, "80 caractères maximum").optional(),
  twitchChannel: z.string().trim().max(100).optional(),
  // Set start.gg "en direct" pour le pari via chat. Chaîne vide = désactive.
  activeChatSetId: z.string().trim().optional(),
  topEightLocked: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { tournamentId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const existing = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!existing) {
    return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404 });
  }

  const tournament = await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.twitchChannel !== undefined
        ? { twitchChannel: normalizeTwitchChannel(parsed.data.twitchChannel) || null }
        : {}),
      ...(parsed.data.activeChatSetId !== undefined
        ? { activeChatSetId: parsed.data.activeChatSetId || null }
        : {}),
      ...(parsed.data.topEightLocked !== undefined
        ? { topEightLocked: parsed.data.topEightLocked }
        : {}),
    },
  });

  return NextResponse.json({ tournament });
}
