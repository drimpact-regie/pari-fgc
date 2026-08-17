import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { partnerAccessCookieName, resolveInvitationalAccess } from "@/lib/invitationalAccess";
import { importMatchesIntoInvitationalEvent } from "@/lib/invitationalEvents";
import { InvitationalImportError, parseInvitationalWorkbook } from "@/lib/invitationalImport";

/**
 * (Ré)importe le fichier rempli par le prestataire dans son event — remplace
 * l'étape où c'était l'admin qui importait le fichier à la création (voir
 * lib/invitationalEvents.ts pour le détail, notamment le verrou de format).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const jar = await cookies();
  const access = await resolveInvitationalAccess(eventId, jar.get(partnerAccessCookieName(eventId))?.value);
  if (!access) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier requis (.xlsx ou .csv)." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseInvitationalWorkbook(buffer, file.name);
    await importMatchesIntoInvitationalEvent(eventId, access.event.format, parsed);
  } catch (err) {
    const message = err instanceof InvitationalImportError ? err.message : "Erreur de lecture du fichier.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
