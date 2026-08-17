import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTwitchChannel } from "@/lib/normalize";

const updateSchema = z.object({
  status: z.enum(["ACTIVE", "PAST"]).optional(),
  twitchChannel: z.string().trim().max(100).optional(),
  activeChatMatchId: z.string().trim().optional(),
  // Match affiché sur l'overlay OBS "match en cours" — désignation
  // indépendante de activeChatMatchId (voir /overlay/invitational/[eventId]/match).
  activeOverlayMatchId: z.string().trim().optional(),
  // Constantes du calcul d'estimation d'horaires (Rundown), reproduites
  // côté site pour l'encart "prochains matchs" de l'overlay bracket — voir
  // lib/invitationalRundown.ts.
  rundownMinSecondsPerRound: z.number().int().positive().optional(),
  rundownMaxSecondsPerRound: z.number().int().positive().optional(),
  rundownSetupSeconds: z.number().int().nonnegative().optional(),
  rundownVerifSeconds: z.number().int().nonnegative().optional(),
  rundownStartAt: z.string().trim().optional(),
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

  let rundownStartAt: Date | null | undefined;
  if (parsed.data.rundownStartAt !== undefined) {
    if (parsed.data.rundownStartAt === "") {
      rundownStartAt = null;
    } else {
      const date = new Date(parsed.data.rundownStartAt);
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: "Heure de début invalide." }, { status: 400 });
      }
      rundownStartAt = date;
    }
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
      ...(parsed.data.activeOverlayMatchId !== undefined
        ? { activeOverlayMatchId: parsed.data.activeOverlayMatchId || null }
        : {}),
      ...(parsed.data.rundownMinSecondsPerRound !== undefined
        ? { rundownMinSecondsPerRound: parsed.data.rundownMinSecondsPerRound }
        : {}),
      ...(parsed.data.rundownMaxSecondsPerRound !== undefined
        ? { rundownMaxSecondsPerRound: parsed.data.rundownMaxSecondsPerRound }
        : {}),
      ...(parsed.data.rundownSetupSeconds !== undefined
        ? { rundownSetupSeconds: parsed.data.rundownSetupSeconds }
        : {}),
      ...(parsed.data.rundownVerifSeconds !== undefined
        ? { rundownVerifSeconds: parsed.data.rundownVerifSeconds }
        : {}),
      ...(rundownStartAt !== undefined ? { rundownStartAt } : {}),
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
