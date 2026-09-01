import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  events: z
    .array(
      z.object({
        eventSlug: z.string().trim().min(1),
        name: z.string().trim().min(1).max(80),
      }),
    )
    .min(1, "Sélectionnez au moins un jeu."),
});

/**
 * Crée un Tournament par jeu sélectionné, à partir de la liste déjà
 * confirmée par /api/admin/tournaments/bulk-import/preview (pas besoin de
 * revérifier chaque event auprès de start.gg — on vient de les lister
 * depuis là, et ça éviterait surtout de multiplier les appels API pour un
 * tournoi à 15 jeux). Les doublons (jeu déjà importé entre-temps) sont
 * ignorés individuellement plutôt que de faire échouer tout le lot.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const created: string[] = [];
  const skipped: string[] = [];

  for (const event of parsed.data.events) {
    try {
      await prisma.tournament.create({
        data: { name: event.name, eventSlug: event.eventSlug },
      });
      created.push(event.name);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        skipped.push(event.name);
        continue;
      }
      throw err;
    }
  }

  return NextResponse.json({ created, skipped });
}
