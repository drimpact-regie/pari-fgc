import { randomBytes } from "crypto";

import type { InvitationalEvent } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Cookie posé après validation d'un lien d'accès "magique" (voir
 * lib/invitationalRequests.ts — prestataire identifié par email, sans
 * compte site). Nommé par event : un cookie ne donne jamais accès qu'à
 * l'event pour lequel il a été émis, même si un même navigateur a visité
 * plusieurs liens au fil du temps.
 */
export function partnerAccessCookieName(eventId: string): string {
  return `invitational_partner_${eventId}`;
}

/** Jeton opaque non devinable, remis dans l'email d'accès (voir lib/email.ts). */
export function generatePartnerAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

export interface InvitationalAccessResult {
  event: InvitationalEvent;
  /** Vrai si l'accès vient d'une session admin (accès complet, tous events). */
  isAdmin: boolean;
  /** Vrai si l'accès vient de la session du compte propriétaire (identification Twitch). */
  isOwner: boolean;
}

/**
 * Point de contrôle unique pour l'accès à un event Invitational/Prestataire
 * côté self-service : admin (accès à tout), propriétaire connecté (session
 * NextAuth, identification Twitch), ou porteur du cookie d'accès valide pour
 * CET event précis (identification manuelle par email). Ne renvoie jamais
 * `event` si aucune de ces trois conditions n'est vraie — un prestataire ne
 * doit jamais pouvoir toucher l'event d'un autre en devinant un id.
 *
 * `cookieValue` est lu par l'appelant (route Handler ou Server Component,
 * `cookies()` de "next/headers") et passé ici plutôt que lu directement dans
 * cette fonction, pour rester appelable aussi bien depuis les deux contextes
 * sans dupliquer l'import de "next/headers" partout.
 */
export async function resolveInvitationalAccess(
  eventId: string,
  cookieValue: string | undefined,
): Promise<InvitationalAccessResult | null> {
  const event = await prisma.invitationalEvent.findUnique({ where: { id: eventId } });
  if (!event) return null;

  const session = await auth();
  if (session?.user?.isAdmin) {
    return { event, isAdmin: true, isOwner: false };
  }
  if (session?.user?.id && event.ownerUserId && session.user.id === event.ownerUserId) {
    return { event, isAdmin: false, isOwner: true };
  }
  if (event.partnerAccessToken && cookieValue && cookieValue === event.partnerAccessToken) {
    return { event, isAdmin: false, isOwner: false };
  }

  return null;
}
