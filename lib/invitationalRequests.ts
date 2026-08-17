import type {
  InvitationalEventRequest,
  InvitationalFormat,
  InvitationalIdentMethod,
  InvitationalRequestStatus,
  Prisma,
} from "@prisma/client";

import { SITE_URL } from "@/config/tournament";
import { buildPartnerAccessEmail, isEmailConfigured, sendEmail } from "@/lib/email";
import { createEmptyInvitationalEvent } from "@/lib/invitationalEvents";
import { generatePartnerAccessToken } from "@/lib/invitationalAccess";
import { prisma } from "@/lib/prisma";

export class InvitationalRequestError extends Error {}

export type InvitationalEventRequestWithRequester = Prisma.InvitationalEventRequestGetPayload<{
  include: { requesterUser: { select: { username: true } } };
}>;

export async function listInvitationalEventRequests(
  status?: InvitationalRequestStatus,
): Promise<InvitationalEventRequestWithRequester[]> {
  return prisma.invitationalEventRequest.findMany({
    where: status ? { status } : undefined,
    include: { requesterUser: { select: { username: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createInvitationalEventRequest(input: {
  eventName: string;
  format: InvitationalFormat;
  twitchChannel: string;
  deadline: Date;
  identMethod: InvitationalIdentMethod;
  clientName: string | null;
  email: string | null;
  requesterUserId: string | null;
}): Promise<InvitationalEventRequest> {
  return prisma.invitationalEventRequest.create({
    data: {
      eventName: input.eventName,
      format: input.format,
      twitchChannel: input.twitchChannel,
      deadline: input.deadline,
      identMethod: input.identMethod,
      clientName: input.clientName,
      email: input.email,
      requesterUserId: input.requesterUserId,
    },
  });
}

function accessUrlFromPath(path: string): string {
  return SITE_URL ? `${SITE_URL}${path}` : path;
}

export interface ConfirmInvitationalEventRequestResult {
  request: InvitationalEventRequest;
  accessUrl: string | null;
  emailSent: boolean;
}

/**
 * Valide une demande : crée l'event (coquille, sans matchs — voir
 * createEmptyInvitationalEvent) et accorde l'accès self-service au
 * prestataire selon la méthode d'identification de sa demande.
 *
 * - TWITCH : le compte déjà identifié (requesterUserId) devient propriétaire
 *   de l'event (InvitationalEvent.ownerUserId) — son accès self-service est
 *   donc disponible dès sa prochaine connexion avec ce même compte, aucun
 *   envoi requis.
 * - MANUAL : génère un jeton d'accès opaque (partnerAccessToken) et tente
 *   d'envoyer le lien d'accès par email. L'envoi est best-effort : s'il
 *   échoue ou si l'email n'est pas configuré (voir lib/email.ts),
 *   `emailSent` remonte false mais la demande reste confirmée — `accessUrl`
 *   est toujours renvoyé pour que l'admin puisse le transmettre à la main.
 */
export async function confirmInvitationalEventRequest(
  requestId: string,
  reviewedByUserId: string,
): Promise<ConfirmInvitationalEventRequestResult> {
  const request = await prisma.invitationalEventRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new InvitationalRequestError("Demande introuvable.");
  if (request.status !== "PENDING") {
    throw new InvitationalRequestError("Cette demande a déjà été traitée.");
  }
  if (request.identMethod === "TWITCH" && !request.requesterUserId) {
    throw new InvitationalRequestError("Demande Twitch sans compte associé — impossible à confirmer.");
  }
  if (request.identMethod === "MANUAL" && !request.email) {
    throw new InvitationalRequestError("Demande manuelle sans email — impossible à confirmer.");
  }

  const partnerAccessToken = request.identMethod === "MANUAL" ? generatePartnerAccessToken() : null;

  const event = await createEmptyInvitationalEvent({
    name: request.eventName,
    eventDate: request.deadline,
    format: request.format,
    twitchChannel: request.twitchChannel,
    requestId: request.id,
    ownerUserId: request.identMethod === "TWITCH" ? request.requesterUserId : null,
    partnerAccessToken,
  });

  let accessUrl: string | null = null;
  let emailSent = false;

  if (request.identMethod === "MANUAL" && partnerAccessToken) {
    accessUrl = accessUrlFromPath(
      `/api/partner/invitational/events/${event.id}/claim?token=${partnerAccessToken}`,
    );
    if (isEmailConfigured()) {
      try {
        await sendEmail(
          buildPartnerAccessEmail({ to: request.email!, eventName: request.eventName, accessUrl }),
        );
        emailSent = true;
      } catch {
        emailSent = false; // best-effort — l'admin transmet accessUrl à la main dans ce cas.
      }
    }
  }

  const updated = await prisma.invitationalEventRequest.update({
    where: { id: requestId },
    data: { status: "CONFIRMED", reviewedAt: new Date(), reviewedByUserId },
  });

  return { request: updated, accessUrl, emailSent };
}

export async function rejectInvitationalEventRequest(
  requestId: string,
  reviewedByUserId: string,
  note: string | null,
): Promise<InvitationalEventRequest> {
  const request = await prisma.invitationalEventRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new InvitationalRequestError("Demande introuvable.");
  if (request.status !== "PENDING") {
    throw new InvitationalRequestError("Cette demande a déjà été traitée.");
  }

  return prisma.invitationalEventRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", rejectionNote: note, reviewedAt: new Date(), reviewedByUserId },
  });
}
