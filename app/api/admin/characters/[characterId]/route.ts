import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  imageUrl: z.string().trim().url("URL d'image invalide").max(500).optional().or(z.literal("")),
});

/** Édition inline de l'image d'un personnage existant (tableau admin). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ characterId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { characterId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const existing = await prisma.character.findUnique({ where: { id: characterId } });
  if (!existing) {
    return NextResponse.json({ error: "Personnage introuvable." }, { status: 404 });
  }

  const character = await prisma.character.update({
    where: { id: characterId },
    data: { imageUrl: parsed.data.imageUrl || null },
  });

  return NextResponse.json({ character });
}

/**
 * Supprime un personnage — pour nettoyer les doublons issus d'un import
 * groupé (voir /api/admin/characters/bulk-import), ex. un nom complet
 * ("Alisa Bosconovitch") laissé vide en double du nom court retenu comme
 * convention ("Alisa"). Bloqué (409) si des paris MVC existent déjà dessus
 * (contrainte de clé étrangère, MvcBet.characterId n'est jamais nullable) —
 * plutôt que de casser silencieusement l'historique de paris déjà résolus.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ characterId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { characterId } = await params;

  const existing = await prisma.character.findUnique({ where: { id: characterId } });
  if (!existing) {
    return NextResponse.json({ error: "Personnage introuvable." }, { status: 404 });
  }

  try {
    await prisma.character.delete({ where: { id: characterId } });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2003"
    ) {
      return NextResponse.json(
        { error: "Impossible de supprimer : des paris existent déjà sur ce personnage." },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json({ deleted: true });
}
