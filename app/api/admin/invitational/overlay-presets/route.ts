import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { overlayLayoutSchema, bracketOverlayLayoutSchema } from "@/lib/invitationalOverlayValidation";

/**
 * Presets d'overlay réutilisables (voir InvitationalOverlayPreset) —
 * réservé à l'admin : calibrer un event et sauvegarder/réappliquer le
 * calage sur d'autres events est une opération de gestion centrale
 * (contrairement au calage lui-même, ouvert au prestataire propriétaire
 * de SON event via /api/admin/invitational/events/[eventId]).
 */

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const presets = await prisma.invitationalOverlayPreset.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ presets });
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80, "80 caractères maximum"),
  overlayLayout: overlayLayoutSchema.optional(),
  bracketOverlayLayout: bracketOverlayLayoutSchema.optional(),
});

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

  const existing = await prisma.invitationalOverlayPreset.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json({ error: "Un preset porte déjà ce nom." }, { status: 409 });
  }

  const preset = await prisma.invitationalOverlayPreset.create({
    data: {
      name: parsed.data.name,
      overlayLayout: parsed.data.overlayLayout ?? undefined,
      bracketOverlayLayout: parsed.data.bracketOverlayLayout ?? undefined,
    },
  });

  return NextResponse.json({ preset });
}
