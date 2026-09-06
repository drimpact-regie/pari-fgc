import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTwitchChannel } from "@/lib/normalize";
import { getTwitchUserByLogin, TwitchApiError } from "@/lib/twitch";

const createSchema = z.object({
  twitchChannel: z.string().trim().min(1, "Chaîne Twitch requise"),
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

  const login = normalizeTwitchChannel(parsed.data.twitchChannel).toLowerCase();

  let twitchUser;
  try {
    twitchUser = await getTwitchUserByLogin(login);
  } catch (err) {
    const message = err instanceof TwitchApiError ? err.message : "Erreur Twitch";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!twitchUser) {
    return NextResponse.json(
      { error: `Aucune chaîne Twitch "${login}" trouvée.` },
      { status: 404 },
    );
  }

  const entry = await prisma.authorizedStreamer.upsert({
    where: { twitchUserId: twitchUser.id },
    update: { twitchLogin: twitchUser.login, displayName: twitchUser.displayName },
    create: {
      twitchLogin: twitchUser.login,
      twitchUserId: twitchUser.id,
      displayName: twitchUser.displayName,
    },
  });

  return NextResponse.json({ streamer: entry });
}
