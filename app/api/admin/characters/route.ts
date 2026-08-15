import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const characterSchema = z.object({
  game: z.string().trim().min(1, "Jeu requis").max(80, "80 caractères maximum"),
  name: z.string().trim().min(1, "Nom requis").max(60, "60 caractères maximum"),
  imageUrl: z.string().trim().url("URL d'image invalide").max(500).optional().or(z.literal("")),
});

/**
 * Ajoute (ou complète) manuellement un personnage au roster d'un jeu — sert
 * de filet de sécurité quand le roster auto-importé est incomplet, ou pour
 * un jeu qui n'a pas encore de roster préchargé.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = characterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const { game, name, imageUrl } = parsed.data;

  const character = await prisma.character.upsert({
    where: { game_name: { game, name } },
    update: { imageUrl: imageUrl || null },
    create: { game, name, imageUrl: imageUrl || null },
  });

  return NextResponse.json({ character });
}
