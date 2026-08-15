import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTournament } from "@/lib/tournaments";

const bracketResetSchema = z.object({
  tournamentId: z.string().min(1),
  predictedYes: z.boolean(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bracketResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const { tournamentId, predictedYes } = parsed.data;

  const tournament = await getTournament(tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404 });
  }

  if (tournament.bracketResetLocked) {
    return NextResponse.json(
      { error: "Le pari reset de bracket est verrouillé pour ce tournoi." },
      { status: 409 },
    );
  }

  const bet = await prisma.bracketResetBet.upsert({
    where: { userId_eventSlug: { userId: session.user.id, eventSlug: tournament.eventSlug } },
    update: { predictedYes },
    create: { userId: session.user.id, eventSlug: tournament.eventSlug, predictedYes },
  });

  return NextResponse.json({ bet });
}
