import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "8 caractères minimum"),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }

  // Un compte créé via Twitch n'a pas encore de mot de passe : on peut en
  // définir un directement, sans mot de passe actuel à vérifier.
  if (user.passwordHash) {
    const { currentPassword } = parsed.data;
    const valid =
      typeof currentPassword === "string" &&
      (await bcrypt.compare(currentPassword, user.passwordHash));
    if (!valid) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 403 });
    }
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
