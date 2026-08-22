import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { activateTournamentRegie, RegieError } from "@/lib/tournamentRegie";

/**
 * Active le "mode régie" (voir Prompt "Mode régie" pour les tournois
 * start.gg) : import figé du bracket + des joueurs dans une InvitationalEvent
 * dédiée, réutilisant ensuite tel quel l'admin/les overlays Invitational.
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
    const event = await activateTournamentRegie(tournamentId);
    return NextResponse.json({ event });
  } catch (err) {
    const message = err instanceof RegieError ? err.message : "Erreur lors de l'activation du mode régie.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
