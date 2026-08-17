import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { declareInvitationalMatchResult, InvitationalResultError } from "@/lib/invitationalMatchResults";
import { partnerAccessCookieName, resolveInvitationalAccess } from "@/lib/invitationalAccess";

const resultSchema = z.object({
  winnerId: z.string().trim().min(1),
  scoreA: z.number().int().nullable().optional(),
  scoreB: z.number().int().nullable().optional(),
});

/**
 * Déclare le vainqueur (et le score) d'un match invitational — seule
 * action qui déclenche la résolution des paris associés (voir
 * lib/invitationalMatchResults.ts). 100% manuel, pas de détection
 * automatique possible (ces events n'existent pas côté start.gg).
 *
 * Accessible à l'admin, mais aussi au prestataire propriétaire de l'event de
 * ce match (portail self-service — voir lib/invitationalAccess.ts).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params;
  const match = await prisma.invitationalMatch.findUnique({ where: { id: matchId } });
  if (!match) {
    return NextResponse.json({ error: "Match introuvable." }, { status: 404 });
  }

  const jar = await cookies();
  const access = await resolveInvitationalAccess(
    match.eventId,
    jar.get(partnerAccessCookieName(match.eventId))?.value,
  );
  if (!access) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = resultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  try {
    const result = await declareInvitationalMatchResult(matchId, {
      winnerId: parsed.data.winnerId,
      scoreA: parsed.data.scoreA ?? null,
      scoreB: parsed.data.scoreB ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof InvitationalResultError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
