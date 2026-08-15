import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { MAX_USERS } from "@/config/tournament";

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "3 caractères minimum")
    .max(32, "32 caractères maximum")
    .regex(/^[a-zA-Z0-9_-]+$/, "Lettres, chiffres, - et _ uniquement"),
  password: z.string().min(8, "8 caractères minimum"),
  inviteCode: z.string().min(1, "Code d'invitation requis"),
});

export async function POST(request: Request) {
  const expectedInviteCode = process.env.INVITE_CODE;
  if (!expectedInviteCode) {
    return NextResponse.json(
      { error: "Inscriptions désactivées (INVITE_CODE non configuré)." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const { username, password, inviteCode } = parsed.data;

  if (inviteCode !== expectedInviteCode) {
    return NextResponse.json(
      { error: "Code d'invitation invalide." },
      { status: 403 },
    );
  }

  const userCount = await prisma.user.count();
  if (userCount >= MAX_USERS) {
    return NextResponse.json(
      {
        error: `Le cercle de parieurs est complet (${MAX_USERS} places).`,
      },
      { status: 403 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: "Ce nom d'utilisateur est déjà pris." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const isFirstUser = userCount === 0;

  await prisma.user.create({
    data: {
      username,
      passwordHash,
      // Le tout premier compte créé devient admin (peut synchroniser les
      // résultats depuis start.gg). Les suivants restent des parieurs.
      isAdmin: isFirstUser,
    },
  });

  return NextResponse.json({ ok: true });
}
