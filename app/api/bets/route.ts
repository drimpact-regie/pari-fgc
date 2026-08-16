import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTournament } from "@/lib/tournaments";
import { getSetResult, isPreviewSetId, SET_STATE, StartggApiError } from "@/lib/startgg";
import { computeMatchOdds } from "@/lib/odds";

const betSchema = z.object({
  tournamentId: z.string().min(1),
  setId: z.string().min(1),
  entrantId: z.string().min(1),
  stake: z.number().int("La mise doit être un nombre entier.").positive("La mise doit être positive."),
});

class InsufficientBalanceError extends Error {}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const bets = await prisma.bet.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ bets });
}

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

  const { tournamentId, setId, entrantId, stake } = parsed.data;

  const tournament = await getTournament(tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404 });
  }

  let set;
  try {
    set = await getSetResult(setId);
  } catch (err) {
    const message = err instanceof StartggApiError ? err.message : "Erreur start.gg";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!set) {
    return NextResponse.json({ error: "Match introuvable." }, { status: 404 });
  }

  // Garde-fou en plus du filtrage à la source (getUpcomingSets) : un match
  // "prévisionnel" (voir isPreviewSetId) n'est pas un vrai match résolvable,
  // y parier créerait un pari bloqué indéfiniment en attente.
  if (isPreviewSetId(set.id)) {
    return NextResponse.json(
      { error: "Ce match n'est pas encore confirmé par start.gg, réessaie une fois le bracket généré." },
      { status: 409 },
    );
  }

  if (set.state !== SET_STATE.NOT_STARTED) {
    return NextResponse.json(
      { error: "Ce match a déjà commencé, les paris sont fermés." },
      { status: 409 },
    );
  }

  const chosenSlot = set.slots.find((slot) => slot.entrant?.id === entrantId);
  const chosenEntrant = chosenSlot?.entrant;
  const opponentSlot = set.slots.find((slot) => slot.entrant && slot.entrant.id !== entrantId);

  if (!chosenEntrant) {
    return NextResponse.json(
      { error: "Ce joueur ne fait pas partie de ce match." },
      { status: 400 },
    );
  }

  // Cote figée au moment du pari : même si les seeds venaient à changer
  // d'ici la résolution, le gain reste calculé sur ce que l'utilisateur a
  // vu au moment de miser.
  const { oddsA: odds } = computeMatchOdds(
    chosenSlot?.seedNum ?? null,
    opponentSlot?.seedNum ?? null,
  );

  try {
    const bet = await prisma.$transaction(async (tx) => {
      // Vérifié et débité dans la même transaction que la création du pari,
      // pour éviter qu'une double soumission concurrente ne fasse passer
      // le solde en négatif entre la vérification et le débit.
      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { exBalance: true },
      });
      if (!user || user.exBalance < stake) {
        throw new InsufficientBalanceError();
      }

      await tx.user.update({
        where: { id: session.user.id },
        data: { exBalance: { decrement: stake } },
      });

      return tx.bet.create({
        data: {
          userId: session.user.id,
          setId,
          eventSlug: tournament.eventSlug,
          roundText: set.fullRoundText ?? "",
          predictedEntrantId: chosenEntrant.id,
          predictedEntrantName: chosenEntrant.name,
          predictedEntrantSeed: chosenSlot?.seedNum ?? null,
          opponentSeed: opponentSlot?.seedNum ?? null,
          totalGames: set.totalGames,
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
      return NextResponse.json(
        { error: "Vous avez déjà parié sur ce match." },
        { status: 409 },
      );
    }
    throw err;
  }
}
