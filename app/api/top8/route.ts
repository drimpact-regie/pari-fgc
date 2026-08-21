import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTournament } from "@/lib/tournaments";
import { getEventEntrants, StartggApiError } from "@/lib/startgg";

const pickSchema = z.object({
  tournamentId: z.string().min(1),
  entrantIds: z.array(z.string().min(1)).min(1, "Choisissez au moins un joueur.").max(8, "8 joueurs maximum."),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = pickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const { tournamentId, entrantIds } = parsed.data;
  const uniqueIds = Array.from(new Set(entrantIds));

  const tournament = await getTournament(tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404 });
  }

  if (tournament.topEightLocked) {
    return NextResponse.json(
      { error: "Les pronostics Top 8 sont verrouillés pour ce tournoi." },
      { status: 409 },
    );
  }

  let entrants;
  try {
    entrants = await getEventEntrants(tournament.eventSlug);
  } catch (err) {
    const message = err instanceof StartggApiError ? err.message : "Erreur start.gg";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const entrantById = new Map(entrants.map((e) => [e.id, e.name]));

  const picks = uniqueIds
    .map((id) => {
      const name = entrantById.get(id);
      return name ? { entrantId: id, entrantName: name } : null;
    })
    .filter((p): p is { entrantId: string; entrantName: string } => p !== null);

  if (picks.length === 0) {
    return NextResponse.json(
      { error: "Aucun des joueurs sélectionnés n'a été trouvé." },
      { status: 400 },
    );
  }

  const saved = await prisma.topEightPick.upsert({
    where: { userId_eventSlug: { userId: session.user.id, eventSlug: tournament.eventSlug } },
    update: { picks },
    create: { userId: session.user.id, eventSlug: tournament.eventSlug, picks },
  });

  return NextResponse.json({ pick: saved });
}
