import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { normalizeTwitchChannel } from "@/lib/normalize";
import { INVITATIONAL_FORMATS } from "@/lib/invitationalFormats";
import { createInvitationalEventRequest } from "@/lib/invitationalRequests";

const requestSchema = z.object({
  eventName: z.string().trim().min(1).max(120),
  format: z.enum(INVITATIONAL_FORMATS as [string, ...string[]]),
  twitchChannel: z.string().trim().min(1).max(100),
  deadline: z.string().trim().min(1),
  identMethod: z.enum(["TWITCH", "MANUAL"]),
  clientName: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
});

/**
 * Soumission publique d'une demande d'event Invitational/Prestataire (voir
 * /invitational/request) — accessible sans compte site (voir proxy.ts,
 * bypass explicite) : la méthode d'identification "Twitch" nécessite malgré
 * tout une session (vérifiée ici), la méthode "manuelle" n'en nécessite
 * aucune mais exige alors nom du client + email.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const deadline = new Date(parsed.data.deadline);
  if (Number.isNaN(deadline.getTime())) {
    return NextResponse.json({ error: "Deadline invalide." }, { status: 400 });
  }

  let requesterUserId: string | null = null;
  let clientName = parsed.data.clientName?.trim() || null;
  const email = parsed.data.email?.trim() || null;

  if (parsed.data.identMethod === "TWITCH") {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Connectez-vous avec Twitch pour utiliser cette méthode d'identification." },
        { status: 401 },
      );
    }
    requesterUserId = session.user.id;
    clientName = clientName || session.user.name || null;
  } else {
    if (!email) {
      return NextResponse.json(
        { error: "Email requis pour une demande sans connexion Twitch." },
        { status: 400 },
      );
    }
    if (!clientName) {
      return NextResponse.json({ error: "Nom du client requis." }, { status: 400 });
    }
  }

  const twitchChannel = normalizeTwitchChannel(parsed.data.twitchChannel);
  if (!twitchChannel) {
    return NextResponse.json({ error: "Chaîne Twitch requise." }, { status: 400 });
  }

  const created = await createInvitationalEventRequest({
    eventName: parsed.data.eventName,
    format: parsed.data.format as (typeof INVITATIONAL_FORMATS)[number],
    twitchChannel,
    deadline,
    identMethod: parsed.data.identMethod,
    clientName,
    email,
    requesterUserId,
  });

  return NextResponse.json({ request: created });
}
