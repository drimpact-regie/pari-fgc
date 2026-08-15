import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTournament } from "@/lib/tournaments";
import { getCompletedSets, getUpcomingSets, isMvcLocked, StartggApiError } from "@/lib/startgg";

const mvcSchema = z.object({
  tournamentId: z.string().min(1),
  characterId: z.string().min(1),
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

  const { tournamentId, characterId, predictedCount } = parsed.data;

  const tournament = await getTournament(tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404 });
  }

  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character) {
    return NextResponse.json({ error: "Personnage introuvable." }, { status: 400 });
  }

  let locked: boolean;
  try {
    const [upcoming, completed] = await Promise.all([
      getUpcomingSets(tournament.eventSlug),
      getCompletedSets(tournament.eventSlug),
    ]);
    locked = isMvcLocked([...upcoming, ...completed], tournament.topEightLocked);
  } catch (err) {
    const message = err instanceof StartggApiError ? err.message : "Erreur start.gg";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (locked) {
    return NextResponse.json(
      { error: "Les paris MVC sont verrouillés pour ce tournoi." },
      { status: 409 },
    );
  }

  const bet = await prisma.mvcBet.upsert({
    where: { userId_eventSlug: { userId: session.user.id, eventSlug: tournament.eventSlug } },
    update: { characterId, predictedCount },
    create: {
      userId: session.user.id,
      eventSlug: tournament.eventSlug,
      characterId,
      predictedCount,
    },
  });

  return NextResponse.json({ bet });
}
