import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { requestOrigin } from "@/lib/domainRouting";

/**
 * Démarre le flux OAuth Twitch self-service par lequel N'IMPORTE QUEL
 * streamer autorise le bot sur sa propre chaîne (scope channel:bot),
 * publiquement et sans connexion préalable au site — ni statut de
 * modérateur/Editor pour qui que ce soit, ni lien avec le compte admin.
 * Seule la connexion Twitch du streamer avec SON PROPRE compte est requise
 * (l'écran d'autorisation Twitch qui suit), ce qui se passe entièrement
 * côté Twitch, hors de notre session.
 *
 * Distinct de /api/twitch/link/connect (lie le compte Twitch d'un
 * utilisateur du site à son profil, scope identité) et de
 * /api/admin/twitch/connect (authentifie le compte qui joue le rôle du
 * bot, admin uniquement).
 */
export async function GET(request: Request) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const origin = requestOrigin(request);
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/streamer?authError=TWITCH_CLIENT_ID%20non%20configur%C3%A9.", origin),
    );
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${origin}/api/streamer/authorize/callback`;

  const authorizeUrl = new URL("https://id.twitch.tv/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "channel:bot");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("force_verify", "true");

  const res = NextResponse.redirect(authorizeUrl.toString());
  res.cookies.set("streamer_authorize_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
