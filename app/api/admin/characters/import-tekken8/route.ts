import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEKKEN8_GAME_NAME, TEKKEN8_ROSTER } from "@/lib/tekken8Roster";

/**
 * Importe le roster TEKKEN 8 en une fois (voir lib/tekken8Roster.ts) —
 * déclenché depuis /admin/characters plutôt que d'ajouter 40+ personnages un
 * par un via le formulaire. `update: {}` : idempotent, ne touche jamais un
 * personnage déjà présent (donc jamais une image déjà renseignée par un
 * admin) — ne fait que compléter les personnages manquants du roster.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  for (const name of TEKKEN8_ROSTER) {
    await prisma.character.upsert({
      where: { game_name: { game: TEKKEN8_GAME_NAME, name } },
      update: {},
      create: { game: TEKKEN8_GAME_NAME, name },
    });
  }

  return NextResponse.json({ imported: TEKKEN8_ROSTER.length });
}
