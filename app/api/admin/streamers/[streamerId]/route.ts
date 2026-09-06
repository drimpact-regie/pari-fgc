import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ streamerId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { streamerId } = await params;

  const existing = await prisma.authorizedStreamer.findUnique({ where: { id: streamerId } });
  if (!existing) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  await prisma.authorizedStreamer.delete({ where: { id: streamerId } });

  return NextResponse.json({ ok: true });
}
