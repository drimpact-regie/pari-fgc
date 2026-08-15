import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTournament } from "@/lib/tournaments";
import { getSetResult, SET_STATE, StartggApiError } from "@/lib/startgg";

const betSchema = z.object({
  tournamentId: z.string().min(1),
  setId: z.string().min(1),
  entrantId: z.string().min(1),
  // Score exact optionnel (bonus de points) : manches gagnées par le
  // joueur pronostiqué vainqueur / par son adversaire.
  predictedEntrantScore: z.number().int().min(0).optional(),
  predictedOpponentScore: z.number().int().min(0).optional(),
});

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

  const { tournamentId, setId, entrantId, predictedEntrantScore, predictedOpponentScore } =
    parsed.data;

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

  let validatedEntrantScore: number | null = null;
  let validatedOpponentScore: number | null = null;
  if (predictedEntrantScore !== undefined || predictedOpponentScore !== undefined) {
    if (predictedEntrantScore === undefined || predictedOpponentScore === undefined) {
      return NextResponse.json({ error: "Score exact incomplet." }, { status: 400 });
    }
    if (!set.totalGames) {
      return NextResponse.json(
        { error: "Format du match inconnu, score exact indisponible." },
        { status: 400 },
      );
    }
    const majority = Math.ceil(set.totalGames / 2);
    if (predictedEntrantScore !== majority || predictedOpponentScore >= majority) {
      return NextResponse.json(
        { error: "Score exact invalide pour ce format de match." },
        { status: 400 },
      );
    }
    validatedEntrantScore = predictedEntrantScore;
    validatedOpponentScore = predictedOpponentScore;
  }

  try {
    const bet = await prisma.bet.create({
      data: {
        userId: session.user.id,
        setId,
        eventSlug: tournament.eventSlug,
        roundText: set.fullRoundText ?? "",
        predictedEntrantId: chosenEntrant.id,
        predictedEntrantName: chosenEntrant.name,
        predictedEntrantScore: validatedEntrantScore,
        predictedOpponentScore: validatedOpponentScore,
        predictedEntrantSeed: chosenSlot?.seedNum ?? null,
        opponentSeed: opponentSlot?.seedNum ?? null,
        totalGames: set.totalGames,
      },
    });
    return NextResponse.json({ bet });
  } catch (err: unknown) {
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
