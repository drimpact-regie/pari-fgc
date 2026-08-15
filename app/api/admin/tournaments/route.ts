import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEventInfo, StartggApiError } from "@/lib/startgg";

/**
 * Accepte soit un slug brut ("tournament/x/event/y"), soit une URL complète
 * start.gg collée telle quelle — erreur d'usage courante à absorber plutôt
 * qu'à rejeter.
 */
function normalizeEventSlug(input: string): string {
  const trimmed = input.trim();
  const marker = "start.gg/";
  const idx = trimmed.indexOf(marker);
  const withoutDomain = idx === -1 ? trimmed : trimmed.slice(idx + marker.length);
  return withoutDomain.replace(/^\/+|\/+$/g, "");
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80, "80 caractères maximum"),
  eventSlug: z.string().trim().min(1, "Lien ou slug start.gg requis"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ tournaments });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const eventSlug = normalizeEventSlug(parsed.data.eventSlug);

  let eventInfo;
  try {
    eventInfo = await getEventInfo(eventSlug);
  } catch (err) {
    const message = err instanceof StartggApiError ? err.message : "Erreur start.gg";
    return NextResponse.json(
      { error: `Impossible de vérifier ce tournoi sur start.gg : ${message}` },
      { status: 502 },
    );
  }

  if (!eventInfo) {
    return NextResponse.json(
      { error: "Aucun event start.gg trouvé pour ce lien/slug. Vérifiez qu'il pointe bien vers un event précis (pas juste le tournoi)." },
      { status: 404 },
    );
  }

  try {
    const tournament = await prisma.tournament.create({
      data: { name: parsed.data.name, eventSlug },
    });
    return NextResponse.json({ tournament });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ce tournoi (même slug start.gg) existe déjà." },
        { status: 409 },
      );
    }
    throw err;
  }
}
