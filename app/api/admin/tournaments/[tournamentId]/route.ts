import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTwitchChannel } from "@/lib/normalize";
import { computeBracketResetPoints } from "@/lib/scoring";
import { deleteSubscription } from "@/lib/twitch";

const updateSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80, "80 caractères maximum").optional(),
  twitchChannel: z.string().trim().max(100).optional(),
  // Set start.gg "en direct" pour le pari via chat. Chaîne vide = désactive.
  activeChatSetId: z.string().trim().optional(),
  topEightLocked: z.boolean().optional(),
  bracketResetLocked: z.boolean().optional(),
  // Résultat réel du reset de bracket — le fournir résout aussi tous les
  // paris BracketResetBet en attente pour ce tournoi.
  bracketResetActual: z.boolean().nullable().optional(),
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
      ...(parsed.data.bracketResetLocked !== undefined
        ? { bracketResetLocked: parsed.data.bracketResetLocked }
        : {}),
      ...(parsed.data.bracketResetActual !== undefined
        ? { bracketResetActual: parsed.data.bracketResetActual }
        : {}),
    },
  });

  if (parsed.data.bracketResetActual !== undefined && parsed.data.bracketResetActual !== null) {
    const actualYes = parsed.data.bracketResetActual;
    const pendingBets = await prisma.bracketResetBet.findMany({
      where: { eventSlug: existing.eventSlug, status: "PENDING" },
    });
    await Promise.all(
      pendingBets.map((bet) => {
        const points = computeBracketResetPoints(bet.predictedYes, actualYes);
        return prisma.bracketResetBet.update({
          where: { id: bet.id },
          data: {
            status: points > 0 ? "WON" : "LOST",
            pointsAwarded: points,
            resolvedAt: new Date(),
          },
        });
      }),
    );
  }

  return NextResponse.json({ tournament });
}

/**
 * Supprime un tournoi. Les paris (Bet, MvcBet, TopEightPick,
 * BracketResetBet) sont rattachés par eventSlug, pas par relation vers
 * Tournament — ils ne sont donc pas supprimés, seulement rendus
 * inaccessibles via les pages de ce tournoi tant qu'aucun tournoi ne
 * réutilise le même eventSlug.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { tournamentId } = await params;

  const existing = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!existing) {
    return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404 });
  }

  // Nettoie l'abonnement EventSub Twitch actif le cas échéant, pour ne pas
  // laisser un abonnement orphelin côté Twitch — best-effort, ne bloque pas
  // la suppression si Twitch est indisponible.
  if (existing.twitchSubscriptionId) {
    try {
      await deleteSubscription(existing.twitchSubscriptionId);
    } catch {
      // best-effort
    }
  }

  await prisma.tournament.delete({ where: { id: tournamentId } });

  return NextResponse.json({ ok: true });
}
