import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ presetId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { presetId } = await params;

  const existing = await prisma.invitationalOverlayPreset.findUnique({ where: { id: presetId } });
  if (!existing) {
    return NextResponse.json({ error: "Preset introuvable." }, { status: 404 });
  }

  await prisma.invitationalOverlayPreset.delete({ where: { id: presetId } });

  return NextResponse.json({ ok: true });
}
