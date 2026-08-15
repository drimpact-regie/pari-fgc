import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STARTGG_EVENT_SLUG } from "@/config/tournament";
import { getSetResult, SET_STATE, StartggApiError } from "@/lib/startgg";

const betSchema = z.object({
  setId: z.string().min(1),
  entrantId: z.string().min(1),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const bets = await prisma.bet.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ bets });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = betSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const { setId, entrantId } = parsed.data;

  let set;
  try {
    set = await getSetResult(setId);
  } catch (err) {
    const message = err instanceof StartggApiError ? err.message : "Erreur start.gg";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!set) {
    return NextResponse.json({ error: "Match introuvable." }, { status: 404 });
  }

  if (set.state !== SET_STATE.NOT_STARTED) {
    return NextResponse.json(
      { error: "Ce match a déjà commencé, les paris sont fermés." },
      { status: 409 },
    );
  }

  const chosenEntrant = set.slots
    .map((slot) => slot.entrant)
    .find((entrant) => entrant?.id === entrantId);

  if (!chosenEntrant) {
    return NextResponse.json(
      { error: "Ce joueur ne fait pas partie de ce match." },
      { status: 400 },
    );
  }

  try {
    const bet = await prisma.bet.create({
      data: {
        userId: session.user.id,
        setId,
        eventSlug: STARTGG_EVENT_SLUG,
        roundText: set.fullRoundText ?? "",
        predictedEntrantId: chosenEntrant.id,
        predictedEntrantName: chosenEntrant.name,
      },
    });
    return NextResponse.json({ bet });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Vous avez déjà parié sur ce match." },
        { status: 409 },
      );
    }
    throw err;
  }
}
