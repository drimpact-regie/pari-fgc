import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, consumeBridgeToken, encodeSessionToken } from "@/lib/ssoBridge";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Destination du pont SSO, sur l'autre domaine : valide le jeton à usage
 * unique émis par /api/auth/bridge/start puis pose le cookie de session
 * Auth.js de CE domaine pour le même utilisateur — invisible pour
 * l'utilisateur, aucun écran de reconnexion.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const next = url.searchParams.get("next") ?? "/";
  const destination = new URL(next, url.origin);

  if (!token) {
    return NextResponse.redirect(destination);
  }

  const user = await consumeBridgeToken(token);
  if (!user) {
    // Jeton invalide, expiré, ou déjà consommé (rejeu) : on atterrit quand
    // même sur la destination mais sans session — les pages protégées
    // redirigeront elles-mêmes vers /login, comme pour un visiteur direct.
    return NextResponse.redirect(destination);
  }

  const sessionToken = await encodeSessionToken(user);
  const res = NextResponse.redirect(destination);
  res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
