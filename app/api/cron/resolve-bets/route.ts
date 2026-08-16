import { NextResponse } from "next/server";

import { resolveAllPendingBets } from "@/lib/matchResults";

/**
 * Filet de sécurité pour la résolution des paris classiques, appelé
 * périodiquement par Vercel Cron (voir vercel.json) plutôt que de dépendre
 * uniquement de l'activité du chat Twitch (voir checkAndAnnounceResults dans
 * app/api/twitch/webhook/route.ts) ou d'un clic admin manuel.
 *
 * Authentifié via le header `Authorization: Bearer <CRON_SECRET>` que
 * Vercel Cron ajoute automatiquement aux appels programmés quand la
 * variable d'environnement CRON_SECRET est définie côté projet Vercel — à
 * configurer manuellement dans les paramètres Vercel, ce environnement
 * sandbox n'y a pas accès.
 *
 * ⚠️ La fréquence réelle d'exécution dépend du plan Vercel du projet (le
 * plan Hobby limite fortement les cron jobs) — non vérifiable depuis cet
 * environnement, à confirmer dans le dashboard Vercel une fois déployé.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const result = await resolveAllPendingBets();
  return NextResponse.json(result);
}
