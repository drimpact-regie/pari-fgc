import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getTournament } from "@/lib/tournaments";
import { invalidateStartggCache } from "@/lib/startggCache";

/**
 * Force le rafraîchissement des données start.gg de CE tournoi (voir
 * invalidateStartggCache) — pour un admin qui veut une donnée à jour tout
 * de suite (ex. juste après le lancement du bracket côté start.gg) sans
 * attendre la fin de la fenêtre de cache (STARTGG_CACHE_SECONDS) ni
 * recharger la page en boucle en espérant qu'elle se rafraîchisse.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { tournamentId } = await params;
  const tournament = await getTournament(tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404 });
  }

  invalidateStartggCache(tournament.eventSlug);
  return NextResponse.json({ ok: true });
}
