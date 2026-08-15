import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POINTS_PER_CORRECT_BET } from "@/config/tournament";
import { getSetResult, SET_STATE, StartggApiError } from "@/lib/startgg";

/**
 * Résout les paris en attente : pour chaque match parié qui est terminé
 * côté start.gg, marque les paris WON/LOST et attribue les points.
 *
 * Accessible soit par un utilisateur admin connecté, soit via un secret
 * partagé (header x-admin-secret), pour permettre un déclenchement externe
 * (cron / webhook) sans session navigateur.
 */
export async function POST(request: Request) {
  const session = await auth();
  const secretHeader = request.headers.get("x-admin-secret");
  const isAuthorized =
    session?.user?.isAdmin === true ||
    (process.env.ADMIN_SYNC_SECRET &&
      secretHeader === process.env.ADMIN_SYNC_SECRET);

  if (!isAuthorized) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const pendingSetIds = await prisma.bet.findMany({
    where: { status: "PENDING" },
    distinct: ["setId"],
    select: { setId: true },
  });

  let resolvedSets = 0;
  let resolvedBets = 0;
  const errors: string[] = [];

  for (const { setId } of pendingSetIds) {
    let set;
    try {
      set = await getSetResult(setId);
    } catch (err) {
      errors.push(
        err instanceof StartggApiError
          ? `${setId}: ${err.message}`
          : `${setId}: erreur inconnue`,
      );
      continue;
    }

    if (!set || set.state !== SET_STATE.COMPLETED || set.winnerId == null) {
      continue;
    }

    const winnerId = String(set.winnerId);
    const bets = await prisma.bet.findMany({
      where: { setId, status: "PENDING" },
    });

    for (const bet of bets) {
      const won = bet.predictedEntrantId === winnerId;
      await prisma.bet.update({
        where: { id: bet.id },
        data: {
          status: won ? "WON" : "LOST",
          pointsAwarded: won ? POINTS_PER_CORRECT_BET : 0,
          resolvedAt: new Date(),
        },
      });
      resolvedBets += 1;
    }
    resolvedSets += 1;
  }

  return NextResponse.json({ resolvedSets, resolvedBets, errors });
}
