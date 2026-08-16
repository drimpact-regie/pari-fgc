import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const adjustmentSchema = z.object({
  amount: z
    .number()
    .int("Le montant doit être un nombre entier.")
    .refine((n) => n !== 0, "Le montant ne peut pas être 0."),
  reason: z.string().trim().min(1, "Raison requise."),
});

/**
 * Crédite (ou débite, montant négatif) manuellement le solde Ex d'un
 * utilisateur — journalisé dans ExAdjustment (qui, quand, combien,
 * pourquoi) plutôt que d'écraser le solde sans trace.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { userId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = adjustmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const { amount, reason } = parsed.data;

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }

  if (targetUser.exBalance + amount < 0) {
    return NextResponse.json(
      { error: `Ce débit ferait passer le solde sous 0 (solde actuel : ${targetUser.exBalance} Ex).` },
      { status: 400 },
    );
  }

  const [, adjustment] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { exBalance: { increment: amount } } }),
    prisma.exAdjustment.create({
      data: {
        userId,
        amount,
        reason,
        adminUsername: session.user.name ?? "admin",
      },
    }),
  ]);

  return NextResponse.json({ adjustment });
}
