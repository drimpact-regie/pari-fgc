import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { exchangeBotAuthCode, TwitchApiError } from "@/lib/twitch";

export async function GET(request: Request) {
  const session = await auth();
  const url = new URL(request.url);

  if (!session?.user?.isAdmin) {
    return NextResponse.redirect(new URL("/", url.origin));
  }

  const error = url.searchParams.get("error");
  if (error) {
    const description = url.searchParams.get("error_description") ?? error;
    return NextResponse.redirect(
      new URL(`/admin/tournaments?twitchError=${encodeURIComponent(description)}`, url.origin),
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      new URL("/admin/tournaments?twitchError=Code%20manquant", url.origin),
    );
  }

  const redirectUri = `${url.origin}/api/admin/twitch/callback`;

  try {
    await exchangeBotAuthCode(code, redirectUri);
  } catch (err) {
    const message = err instanceof TwitchApiError ? err.message : "Erreur inconnue.";
    return NextResponse.redirect(
      new URL(`/admin/tournaments?twitchError=${encodeURIComponent(message)}`, url.origin),
    );
  }

  return NextResponse.redirect(new URL("/admin/tournaments?twitchConnected=1", url.origin));
}
