import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/**
 * Démarre le flux OAuth Twitch pour le compte "bot" utilisé à lire le chat.
 * Deux scopes nécessaires : user:read:chat (lire les messages) et user:bot
 * (déclare que ce compte agit comme un bot — sans lui, Twitch refuse la
 * création de l'abonnement channel.chat.message avec "subscription missing
 * proper authorization" même si le compte est modérateur). Le redirect_uri
 * est dérivé de la requête en cours : il doit correspondre EXACTEMENT à une
 * des URL de redirection enregistrées dans la console développeur Twitch.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "TWITCH_CLIENT_ID n'est pas configuré." },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/admin/twitch/callback`;

  const authorizeUrl = new URL("https://id.twitch.tv/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "user:read:chat user:bot");
  authorizeUrl.searchParams.set("force_verify", "true");

  return NextResponse.redirect(authorizeUrl.toString());
}
