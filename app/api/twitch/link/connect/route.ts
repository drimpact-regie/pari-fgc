import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { auth } from "@/lib/auth";
import { requestOrigin } from "@/lib/domainRouting";

/**
 * Démarre le flux OAuth Twitch pour lier le compte Twitch de l'utilisateur
 * connecté à son compte Impact'O Bet (nécessaire pour parier via le chat).
 * Distinct de /api/admin/twitch/connect qui authentifie le compte du bot.
 *
 * Un état aléatoire est stocké en cookie httpOnly le temps de l'aller-retour
 * OAuth, pour éviter qu'un lien forgé par un tiers ne fasse lier le compte
 * Twitch de quelqu'un d'autre au compte de la victime (CSRF de liaison).
 */
export async function GET(request: Request) {
  const session = await auth();
  const origin = requestOrigin(request);

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login?from=%2Faccount", origin));
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/account?linkError=TWITCH_CLIENT_ID%20non%20configur%C3%A9.", origin),
    );
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${origin}/api/twitch/link/callback`;

  const authorizeUrl = new URL("https://id.twitch.tv/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("force_verify", "true");

  const res = NextResponse.redirect(authorizeUrl.toString());
  res.cookies.set("twitch_link_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
