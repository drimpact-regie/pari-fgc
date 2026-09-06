import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { exchangeBotAuthCode, TwitchApiError } from "@/lib/twitch";
import { requestOrigin } from "@/lib/domainRouting";

export async function GET(request: Request) {
  const session = await auth();
  const url = new URL(request.url);
  const origin = requestOrigin(request);

  if (!session?.user?.isAdmin) {
    return NextResponse.redirect(new URL("/", origin));
  }

  const error = url.searchParams.get("error");
  if (error) {
    const description = url.searchParams.get("error_description") ?? error;
    return NextResponse.redirect(
      new URL(`/admin/tournaments?twitchError=${encodeURIComponent(description)}`, origin),
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      new URL("/admin/tournaments?twitchError=Code%20manquant", origin),
    );
  }

  const redirectUri = `${origin}/api/admin/twitch/callback`;

  try {
    await exchangeBotAuthCode(code, redirectUri);
  } catch (err) {
    const message = err instanceof TwitchApiError ? err.message : "Erreur inconnue.";
    return NextResponse.redirect(
      new URL(`/admin/tournaments?twitchError=${encodeURIComponent(message)}`, origin),
    );
  }

  return NextResponse.redirect(new URL("/admin/tournaments?twitchConnected=1", origin));
}
