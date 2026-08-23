import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { exchangeUserAuthCode, TwitchApiError } from "@/lib/twitch";
import { requestOrigin } from "@/lib/domainRouting";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = requestOrigin(request);

  function redirectTo(destination: string) {
    const res = NextResponse.redirect(new URL(destination, origin));
    res.cookies.delete("streamer_authorize_state");
    return res;
  }

  const error = url.searchParams.get("error");
  if (error) {
    const description = url.searchParams.get("error_description") ?? error;
    return redirectTo(`/streamer?authError=${encodeURIComponent(description)}`);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("streamer_authorize_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectTo(
      `/streamer?authError=${encodeURIComponent("Requête invalide ou expirée, réessaie.")}`,
    );
  }

  const redirectUri = `${origin}/api/streamer/authorize/callback`;

  let twitchUser;
  try {
    twitchUser = await exchangeUserAuthCode(code, redirectUri);
  } catch (err) {
    const message = err instanceof TwitchApiError ? err.message : "Erreur inconnue.";
    return redirectTo(`/streamer?authError=${encodeURIComponent(message)}`);
  }

  // Capture quel compte joue le rôle du bot au moment de cet octroi, pour
  // pouvoir détecter plus tard un décalage si ce compte change (voir
  // /admin/tournaments et le modèle StreamerChannelAuthorization).
  const botToken = await prisma.twitchBotToken.findUnique({ where: { id: "singleton" } });
  // Login normalisé en minuscules pour matcher Tournament.twitchChannel
  // (saisi librement par un admin, casse non garantie) — voir
  // lib/streamerAuthorization.ts.
  const twitchLogin = twitchUser.login.toLowerCase();

  await prisma.streamerChannelAuthorization.upsert({
    where: { twitchLogin },
    update: { twitchUserId: twitchUser.id, botLoginAtGrant: botToken?.login ?? "inconnu" },
    create: {
      twitchLogin,
      twitchUserId: twitchUser.id,
      botLoginAtGrant: botToken?.login ?? "inconnu",
    },
  });

  return redirectTo(`/streamer?authorized=${encodeURIComponent(twitchUser.login)}`);
}
