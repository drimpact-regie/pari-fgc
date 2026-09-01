import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEventInfo, StartggApiError } from "@/lib/startgg";

const bulkImportSchema = z.object({
  tournamentId: z.string().trim().min(1, "Tournoi requis"),
  names: z.array(z.string().trim().min(1)).min(1, "Colle au moins un nom de personnage."),
});

/**
 * Import groupé du roster d'un jeu, en une seule fois — plutôt que de coder
 * un fichier roster + une route dédiée par jeu (voir lib/tekken8Roster.ts +
 * import-tekken8/route.ts, non réutilisable pour un autre jeu). Le jeu
 * n'est jamais tapé à la main ici : il est résolu depuis start.gg via le
 * tournoi choisi (event.videogame.name), pour garantir un match exact avec
 * Character.game — un nom mal orthographié romprait silencieusement le
 * matching MVC (voir la mise en garde dans lib/tekken8Roster.ts).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bulkImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: parsed.data.tournamentId },
    select: { eventSlug: true },
  });
  if (!tournament) {
    return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404 });
  }

  let eventInfo;
  try {
    eventInfo = await getEventInfo(tournament.eventSlug);
  } catch (err) {
    const message = err instanceof StartggApiError ? err.message : "Erreur start.gg";
    return NextResponse.json(
      { error: `Impossible de vérifier ce tournoi sur start.gg : ${message}` },
      { status: 502 },
    );
  }

  const game = eventInfo?.videogameName;
  if (!game) {
    return NextResponse.json(
      { error: "start.gg ne renvoie pas de jeu pour ce tournoi — impossible de déterminer le nom exact." },
      { status: 422 },
    );
  }

  // Dédoublonne (même nom collé deux fois) sans casser l'ordre saisi.
  const names = Array.from(new Set(parsed.data.names));

  for (const name of names) {
    await prisma.character.upsert({
      where: { game_name: { game, name } },
      update: {},
      create: { game, name },
    });
  }

  return NextResponse.json({ game, imported: names.length });
}
