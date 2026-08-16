import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeStreakOdds } from "@/lib/invitationalOdds";

const betSchema = z.object({
  matchId: z.string().min(1),
  competitorId: z.string().min(1),
  stake: z.number().int("La mise doit être un nombre entier.").positive("La mise doit être positive."),
});

class InsufficientBalanceError extends Error {}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const bets = await prisma.invitationalBet.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ bets });
}

/**
 * Place un pari Invitational/Prestataire : même garantie que les paris
 * classiques (mise débitée immédiatement, cote figée au moment du pari,
 * dans la même transaction), mais sur le solde invitationalExBalance —
 * complètement séparé du solde exBalance des tournois classiques (voir
 * Partie 4 du prompt d'origine). La cote est recalculée ici à partir des
 * séries de victoires en cours des deux compétiteurs (lib/invitationalOdds.ts)
 * plutôt que d'être transmise par le client, pour ne jamais faire confiance à
 * une cote calculée côté navigateur.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = betSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const { matchId, competitorId, stake } = parsed.data;

  const match = await prisma.invitationalMatch.findUnique({
    where: { id: matchId },
    include: { competitorA: true, competitorB: true },
  });
  if (!match) {
    return NextResponse.json({ error: "Match introuvable." }, { status: 404 });
  }
  if (match.status !== "OPEN") {
    return NextResponse.json({ error: "Ce match n'est pas ouvert au pari." }, { status: 409 });
  }
  if (!match.competitorA || !match.competitorB) {
    return NextResponse.json({ error: "Les deux compétiteurs ne sont pas encore désignés." }, { status: 409 });
  }

  const chosen =
    competitorId === match.competitorA.id
      ? match.competitorA
      : competitorId === match.competitorB.id
        ? match.competitorB
        : null;
  if (!chosen) {
    return NextResponse.json({ error: "Ce compétiteur ne fait pas partie de ce match." }, { status: 400 });
  }

  const { oddsA, oddsB } = computeStreakOdds(match.competitorA.currentStreak, match.competitorB.currentStreak);
  const odds = competitorId === match.competitorA.id ? oddsA : oddsB;

  try {
    const bet = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { invitationalExBalance: true },
      });
      if (!user || user.invitationalExBalance < stake) {
        throw new InsufficientBalanceError();
      }

      await tx.user.update({
        where: { id: session.user.id },
        data: { invitationalExBalance: { decrement: stake } },
      });

      return tx.invitationalBet.create({
        data: {
          userId: session.user.id,
          matchId,
          eventId: match.eventId,
          predictedCompetitorId: chosen.id,
          predictedCompetitorName: chosen.name,
          stake,
          odds,
        },
      });
    });

    return NextResponse.json({ bet });
  } catch (err: unknown) {
    if (err instanceof InsufficientBalanceError) {
      return NextResponse.json({ error: "Solde Ex insuffisant pour cette mise." }, { status: 400 });
    }
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "Vous avez déjà parié sur ce match." }, { status: 409 });
    }
    throw err;
  }
}
