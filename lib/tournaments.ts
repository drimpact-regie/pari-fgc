import type { Tournament } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { DEFAULT_TOURNAMENT_NAME, STARTGG_EVENT_SLUG } from "@/config/tournament";
import { getEventInfo, tournamentSlugFromEventSlug } from "@/lib/startgg";

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

export interface TournamentCardInfo {
  id: string;
  name: string;
  bannerUrl: string | null;
  videogameImageUrl: string | null;
}

export interface TournamentGroupInfo {
  rootSlug: string;
  label: string;
  bannerUrl: string | null;
  cards: TournamentCardInfo[];
}

/**
 * Regroupe des tournois déjà triés (voir `sorted` chez les appelants) par
 * racine start.gg partagée — un tournoi multi-jeux (ex : "Ultimate Fighting
 * Arena", ~24 jeux) importe chaque jeu comme un Tournament séparé (voir
 * BulkImportTournamentsForm), mais ils restent rattachés au même événement
 * "parent" côté start.gg. Utilisé à la fois par l'accueil parieur
 * (app/(site)/page.tsx) et par /admin/tournaments — d'où ce helper partagé
 * plutôt que dupliquer la logique de regroupement dans les deux pages.
 */
export async function groupTournamentsForDisplay(
  tournaments: Tournament[],
): Promise<TournamentGroupInfo[]> {
  const eventInfos = await Promise.all(
    tournaments.map((t) => getEventInfo(t.eventSlug).catch(() => null)),
  );

  const groups: TournamentGroupInfo[] = [];
  const groupByRoot = new Map<string, TournamentGroupInfo>();
  for (let i = 0; i < tournaments.length; i++) {
    const rootSlug = tournamentSlugFromEventSlug(tournaments[i].eventSlug);
    let group = groupByRoot.get(rootSlug);
    if (!group) {
      group = {
        rootSlug,
        label: eventInfos[i]?.tournamentName || tournaments[i].name,
        bannerUrl: eventInfos[i]?.bannerUrl ?? null,
        cards: [],
      };
      groupByRoot.set(rootSlug, group);
      groups.push(group);
    }
    group.cards.push({
      id: tournaments[i].id,
      name: tournaments[i].name,
      bannerUrl: eventInfos[i]?.bannerUrl ?? null,
      videogameImageUrl: eventInfos[i]?.videogameImageUrl ?? null,
    });
  }

  return groups;
}
