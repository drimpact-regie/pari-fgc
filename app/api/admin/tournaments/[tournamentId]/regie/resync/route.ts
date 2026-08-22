import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { RegieError, resyncTournamentRegie } from "@/lib/tournamentRegie";

/**
 * Resynchronise le mode régie depuis start.gg : fusionne (jamais n'écrase
 * un match déjà en cours/joué) — même garantie que le réimport Excel
 * Invitational, voir importMatchesIntoInvitationalEvent.
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

  try {
    const summary = await resyncTournamentRegie(tournamentId);
    return NextResponse.json({ summary });
  } catch (err) {
    const message = err instanceof RegieError ? err.message : "Erreur lors de la resynchronisation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
