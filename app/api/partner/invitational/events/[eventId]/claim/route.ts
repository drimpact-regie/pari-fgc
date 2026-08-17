import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { partnerAccessCookieName } from "@/lib/invitationalAccess";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 jours

/**
 * Point d'entrée du lien "magique" envoyé par email au prestataire
 * identifié manuellement (voir lib/invitationalRequests.ts /
 * lib/email.ts) : valide le jeton, pose le cookie d'accès scopé à CET
 * event (voir lib/invitationalAccess.ts), puis redirige vers la page de
 * gestion — qu'il visitera ensuite directement à chaque nouvelle session
 * sans repasser par ce lien tant que le cookie tient.
 *
 * Un jeton invalide/absent ne pose simplement pas le cookie : la
 * redirection a lieu quand même, la page de destination refusant alors
 * l'accès normalement (pas de page d'erreur séparée à maintenir).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  const event = await prisma.invitationalEvent.findUnique({
    where: { id: eventId },
    select: { partnerAccessToken: true },
  });

  if (event?.partnerAccessToken && token && token === event.partnerAccessToken) {
    const jar = await cookies();
    jar.set(partnerAccessCookieName(eventId), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });
  }

  return NextResponse.redirect(new URL(`/partner/invitational/${eventId}`, request.url));
}
