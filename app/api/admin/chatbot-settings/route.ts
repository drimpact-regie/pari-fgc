import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CHATBOT_FEATURES } from "@/lib/chatbotSettings";

const featureKeys = CHATBOT_FEATURES.map((f) => f.key) as [string, ...string[]];

const updateSchema = z
  .object(Object.fromEntries(featureKeys.map((key) => [key, z.boolean().optional()])))
  .partial();

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const settings = await prisma.chatbotSettings.upsert({
    where: { id: "singleton" },
    update: parsed.data,
    create: { id: "singleton", ...parsed.data },
  });

  return NextResponse.json({ settings });
}
