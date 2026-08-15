import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTournament } from "@/lib/tournaments";

const mvcSchema = z.object({
  tournamentId: z.string().min(1),
  character: z.string().trim().min(1, "Personnage requis").max(60, "60 caractères maximum"),
  predictedCount: z.number().int().min(0).max(8),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = mvcSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const { tournamentId, character, predictedCount } = parsed.data;

  const tournament = await getTournament(tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404 });
  }

  // Même verrou que le Top 8 : le MVC se devine avant que le top 8 soit connu.
  if (tournament.topEightLocked) {
    return NextResponse.json(
      { error: "Les paris MVC sont verrouillés pour ce tournoi." },
      { status: 409 },
    );
  }

  const bet = await prisma.mvcBet.upsert({
    where: { userId_eventSlug: { userId: session.user.id, eventSlug: tournament.eventSlug } },
    update: { character, characterKey: character.toLowerCase(), predictedCount },
    create: {
      userId: session.user.id,
      eventSlug: tournament.eventSlug,
      character,
      characterKey: character.toLowerCase(),
      predictedCount,
    },
  });

  return NextResponse.json({ bet });
}
