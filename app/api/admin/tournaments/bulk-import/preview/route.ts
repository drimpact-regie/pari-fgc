import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTournamentEvents, StartggApiError } from "@/lib/startgg";
import { normalizeTournamentSlug } from "@/lib/normalize";

const previewSchema = z.object({
  tournamentSlug: z.string().trim().min(1, "Lien ou slug start.gg requis"),
});

/**
 * Liste les jeux d'un tournoi start.gg multi-jeux (import groupé, voir
 * /api/admin/tournaments/bulk-import pour la création) — étape séparée en
 * lecture seule pour laisser l'admin choisir lesquels importer avant tout
 * écriture en base.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const tournamentSlug = normalizeTournamentSlug(parsed.data.tournamentSlug);

  let result;
  try {
    result = await getTournamentEvents(tournamentSlug);
  } catch (err) {
    const message = err instanceof StartggApiError ? err.message : "Erreur start.gg";
    return NextResponse.json(
      { error: `Impossible de récupérer ce tournoi sur start.gg : ${message}` },
      { status: 502 },
    );
  }

  if (!result) {
    return NextResponse.json(
      { error: "Aucun tournoi start.gg trouvé pour ce lien/slug. Vérifiez qu'il pointe bien vers la racine du tournoi (pas un jeu précis)." },
      { status: 404 },
    );
  }

  if (result.events.length === 0) {
    return NextResponse.json(
      { error: "Ce tournoi ne contient aucun jeu (event) côté start.gg." },
      { status: 404 },
    );
  }

  const eventSlugs = result.events.map((event) => event.eventSlug);
  const existing = await prisma.tournament.findMany({
    where: { eventSlug: { in: eventSlugs } },
    select: { eventSlug: true },
  });
  const existingSet = new Set(existing.map((t) => t.eventSlug));

  return NextResponse.json({
    tournamentName: result.tournamentName,
    events: result.events.map((event) => ({
      ...event,
      alreadyImported: existingSet.has(event.eventSlug),
    })),
  });
}
