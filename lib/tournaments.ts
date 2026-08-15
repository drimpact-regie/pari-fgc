import type { Tournament } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { DEFAULT_TOURNAMENT_NAME, STARTGG_EVENT_SLUG } from "@/config/tournament";

/**
 * Liste les tournois suivis, du plus ancien au plus récent (ordre des
 * onglets). Amorce automatiquement un premier tournoi à partir de la config
 * par défaut si la table est encore vide (premier démarrage de l'app).
 */
export async function listTournaments(): Promise<Tournament[]> {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: "asc" },
  });

  if (tournaments.length > 0) return tournaments;

  const seeded = await prisma.tournament.upsert({
    where: { eventSlug: STARTGG_EVENT_SLUG },
    update: {},
    create: { name: DEFAULT_TOURNAMENT_NAME, eventSlug: STARTGG_EVENT_SLUG },
  });
  return [seeded];
}

export async function getTournament(id: string): Promise<Tournament | null> {
  return prisma.tournament.findUnique({ where: { id } });
}
