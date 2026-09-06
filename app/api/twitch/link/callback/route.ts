import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeUserAuthCode, TwitchApiError } from "@/lib/twitch";
import { requestOrigin } from "@/lib/domainRouting";

export async function GET(request: Request) {
  const session = await auth();
  const url = new URL(request.url);
  const origin = requestOrigin(request);

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  function redirectTo(destination: string) {
    const res = NextResponse.redirect(new URL(destination, origin));
    res.cookies.delete("twitch_link_state");
    return res;
  }

  const error = url.searchParams.get("error");
  if (error) {
    const description = url.searchParams.get("error_description") ?? error;
    return redirectTo(`/account?linkError=${encodeURIComponent(description)}`);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("twitch_link_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectTo(
      `/account?linkError=${encodeURIComponent("Requête invalide ou expirée, réessaie.")}`,
    );
  }

  const redirectUri = `${origin}/api/twitch/link/callback`;

  let twitchUser;
  try {
    twitchUser = await exchangeUserAuthCode(code, redirectUri);
  } catch (err) {
    const message = err instanceof TwitchApiError ? err.message : "Erreur inconnue.";
    return redirectTo(`/account?linkError=${encodeURIComponent(message)}`);
  }

  const existing = await prisma.user.findUnique({ where: { twitchId: twitchUser.id } });
  if (existing && existing.id !== session.user.id) {
    return redirectTo(
      `/account?linkError=${encodeURIComponent(
        "Ce compte Twitch est déjà lié à un autre compte Impact'O Bet — contacte un admin.",
      )}`,
    );
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { twitchId: twitchUser.id } });

  return redirectTo("/account?linked=1");
}
