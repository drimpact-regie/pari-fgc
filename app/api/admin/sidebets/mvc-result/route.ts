import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTournament } from "@/lib/tournaments";
import { computeMvcPoints } from "@/lib/scoring";

const resultSchema = z.object({
  tournamentId: z.string().min(1),
  characterKey: z.string().min(1),
  actualCount: z.number().int().min(0).max(8),
});

/**
 * Saisit le nombre réel d'apparitions d'un personnage MVC dans le top 8, et
 * résout dans la foulée tous les paris portant sur ce personnage pour ce
 * tournoi (un seul personnage peut avoir été parié par plusieurs joueurs).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = resultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const { tournamentId, characterKey, actualCount } = parsed.data;

  const tournament = await getTournament(tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404 });
  }

  const bets = await prisma.mvcBet.findMany({
    where: { eventSlug: tournament.eventSlug, characterKey },
  });

  await Promise.all(
    bets.map((bet) => {
      const points = computeMvcPoints(bet.predictedCount, actualCount);
      return prisma.mvcBet.update({
        where: { id: bet.id },
        data: {
          actualCount,
          status: points > 0 ? "WON" : "LOST",
          pointsAwarded: points,
          resolvedAt: new Date(),
        },
      });
    }),
  );

  return NextResponse.json({ resolved: bets.length });
}
