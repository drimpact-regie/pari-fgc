import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { declareInvitationalMatchResult, InvitationalResultError } from "@/lib/invitationalMatchResults";

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
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { matchId } = await params;
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
