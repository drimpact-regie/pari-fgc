import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { confirmInvitationalEventRequest, InvitationalRequestError } from "@/lib/invitationalRequests";

/**
 * Confirme une demande d'event Invitational/Prestataire : crée l'event et
 * accorde l'accès self-service au prestataire (voir
 * lib/invitationalRequests.ts pour le détail selon la méthode
 * d'identification de la demande).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { requestId } = await params;

  try {
    const result = await confirmInvitationalEventRequest(requestId, session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof InvitationalRequestError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
