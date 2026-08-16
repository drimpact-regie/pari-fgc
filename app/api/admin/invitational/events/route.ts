import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createInvitationalEvent, listInvitationalEvents } from "@/lib/invitationalEvents";
import { InvitationalImportError, parseInvitationalWorkbook } from "@/lib/invitationalImport";

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const events = await listInvitationalEvents();
  return NextResponse.json({ events });
}

/**
 * Crée un event Invitational/Prestataire : nom + date fournis par le
 * formulaire admin, format + structure des matchs entièrement dérivés du
 * fichier importé (voir docs/invitational-import-format.md) — jamais
 * saisis manuellement à la création.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const name = String(formData.get("name") ?? "").trim();
  const eventDateRaw = String(formData.get("eventDate") ?? "").trim();
  const file = formData.get("file");

  if (!name) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }
  const eventDate = new Date(eventDateRaw);
  if (Number.isNaN(eventDate.getTime())) {
    return NextResponse.json({ error: "Date invalide." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier requis (.xlsx ou .csv)." }, { status: 400 });
  }

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = parseInvitationalWorkbook(buffer, file.name);
  } catch (err) {
    const message = err instanceof InvitationalImportError ? err.message : "Erreur de lecture du fichier.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const event = await createInvitationalEvent({ name, eventDate, parsed });
  return NextResponse.json({ event });
}
