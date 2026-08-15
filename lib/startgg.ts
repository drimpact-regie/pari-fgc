/**
 * Client pour l'API GraphQL de start.gg.
 *
 * La logique des requêtes (Fn_AppelAPI, Req_MatchsAVenir, Req_StatsJoueurs)
 * reprend celle du fichier "Bet Graph SQL Start GG.xlsx" (Power Query),
 * adaptée en GraphQL avec variables (plutôt que concaténation de texte) et
 * en TypeScript typé.
 *
 * Le token d'API n'est JAMAIS codé en dur : il est lu depuis la variable
 * d'environnement STARTGG_TOKEN (cf. Fn_AppelAPI dans le fichier Excel, qui
 * utilisait "Param_Token" — ici on lit process.env côté serveur uniquement).
 */

import { STARTGG_CACHE_SECONDS, STARTGG_EVENT_SLUG } from "@/config/tournament";

const STARTGG_API_URL = "https://api.start.gg/gql/alpha";

export class StartggApiError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "StartggApiError";
  }
}

/** Équivalent de Fn_AppelAPI: POST GraphQL authentifié par Bearer token. */
async function callStartGG<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const token = process.env.STARTGG_TOKEN;
  if (!token) {
    throw new StartggApiError(
      "STARTGG_TOKEN n'est pas défini dans l'environnement du serveur.",
    );
  }

  let res: Response;
  try {
    res = await fetch(STARTGG_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      // Cache côté serveur Next.js pour ne pas marteler l'API start.gg à
      // chaque chargement de page par un des ~30 parieurs.
      next: { revalidate: STARTGG_CACHE_SECONDS },
    });
  } catch (err) {
    throw new StartggApiError(
      "Impossible de joindre l'API start.gg (réseau).",
      err,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new StartggApiError(
      `L'API start.gg a répondu ${res.status} ${res.statusText}.`,
      text,
    );
  }

  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) {
    throw new StartggApiError("Erreur GraphQL renvoyée par start.gg.", json.errors);
  }
  if (!json.data) {
    throw new StartggApiError("Réponse start.gg vide.");
  }
  return json.data;
}

// --- Types -----------------------------------------------------------------

export interface StartggEntrant {
  id: string;
  name: string;
}

export interface StartggSetSlot {
  entrant: StartggEntrant | null;
}

/** État d'un set côté start.gg: 1 = à venir, 2 = en cours, 3 = terminé. */
export const SET_STATE = {
  NOT_STARTED: 1,
  STARTED: 2,
  COMPLETED: 3,
} as const;

export interface StartggSet {
  id: string;
  round: number;
  fullRoundText: string;
  state: number;
  winnerId: number | null;
  slots: StartggSetSlot[];
}

export interface StartggStanding {
  placement: number | null;
  entrant: StartggEntrant | null;
}

export interface StartggEventInfo {
  id: string;
  name: string;
  state: string | null;
  numEntrants: number | null;
  tournamentName: string;
  /** Image de bannière/fond du tournoi (côté start.gg), si disponible. */
  bannerUrl: string | null;
}

// --- Requêtes GraphQL --------------------------------------------------------

const EVENT_INFO_QUERY = /* GraphQL */ `
  query EventInfo($eventSlug: String!) {
    event(slug: $eventSlug) {
      id
      name
      state
      numEntrants
      tournament {
        name
        images {
          url
          type
        }
      }
    }
  }
`;

/** Équivalent de Req_MatchsAVenir: sets pas encore terminés (état 1 ou 2). */
const UPCOMING_SETS_QUERY = /* GraphQL */ `
  query UpcomingSets($eventSlug: String!, $page: Int!, $perPage: Int!) {
    event(slug: $eventSlug) {
      sets(
        perPage: $perPage
        page: $page
        sortType: STANDARD
        filters: { state: [1, 2] }
      ) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          round
          fullRoundText
          state
          winnerId
          slots {
            entrant {
              id
              name
            }
          }
        }
      }
    }
  }
`;

/** Sets terminés — sert au calcul du palmarès et à la résolution des paris. */
const COMPLETED_SETS_QUERY = /* GraphQL */ `
  query CompletedSets($eventSlug: String!, $page: Int!, $perPage: Int!) {
    event(slug: $eventSlug) {
      sets(
        perPage: $perPage
        page: $page
        sortType: STANDARD
        filters: { state: [3] }
      ) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          round
          fullRoundText
          state
          winnerId
          slots {
            entrant {
              id
              name
            }
          }
        }
      }
    }
  }
`;

/** Équivalent de Req_StatsJoueurs: classement (placement) par joueur. */
const STANDINGS_QUERY = /* GraphQL */ `
  query PlayerStandings($eventSlug: String!, $page: Int!, $perPage: Int!) {
    event(slug: $eventSlug) {
      standings(query: { perPage: $perPage, page: $page }) {
        pageInfo {
          totalPages
        }
        nodes {
          placement
          entrant {
            id
            name
          }
        }
      }
    }
  }
`;

const SET_RESULT_QUERY = /* GraphQL */ `
  query SetResult($setId: ID!) {
    set(id: $setId) {
      id
      state
      winnerId
      slots {
        entrant {
          id
          name
        }
      }
    }
  }
`;

// --- Pagination --------------------------------------------------------------

const MAX_PAGES = 5;
const PER_PAGE = 50;

async function fetchAllPages<TNode>(
  fetchPage: (page: number) => Promise<{ nodes: TNode[]; totalPages: number } | null>,
): Promise<TNode[]> {
  const all: TNode[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await fetchPage(page);
    if (!result) break;
    all.push(...result.nodes);
    totalPages = result.totalPages || 1;
    page += 1;
  } while (page <= totalPages && page <= MAX_PAGES);
  return all;
}

// --- API publique --------------------------------------------------------------

export async function getEventInfo(
  eventSlug: string = STARTGG_EVENT_SLUG,
): Promise<StartggEventInfo | null> {
  const data = await callStartGG<{
    event: {
      id: string;
      name: string;
      state: string | null;
      numEntrants: number | null;
      tournament: {
        name: string;
        images: { url: string; type: string | null }[] | null;
      } | null;
    } | null;
  }>(EVENT_INFO_QUERY, { eventSlug });

  if (!data.event) return null;

  const images = data.event.tournament?.images ?? [];
  const banner = images.find((img) => img.type === "banner") ?? images[0] ?? null;

  return {
    id: data.event.id,
    name: data.event.name,
    state: data.event.state,
    numEntrants: data.event.numEntrants,
    tournamentName: data.event.tournament?.name ?? "",
    bannerUrl: banner?.url ?? null,
  };
}

/**
 * L'API start.gg renvoie `entrant.id` (et `set.id`) en tant que nombre côté
 * JSON, alors qu'on les manipule comme des chaînes partout dans l'app
 * (formulaires, validation Zod, clés Prisma). On normalise donc en string
 * dès la sortie de l'API pour éviter tout mismatch de type en aval.
 */
function normalizeEntrant(entrant: StartggEntrant | null): StartggEntrant | null {
  if (!entrant) return null;
  return { id: String(entrant.id), name: entrant.name };
}

function normalizeSet(set: StartggSet): StartggSet {
  return {
    ...set,
    id: String(set.id),
    slots: set.slots.map((slot) => ({ entrant: normalizeEntrant(slot.entrant) })),
  };
}

function normalizeStanding(standing: StartggStanding): StartggStanding {
  return { ...standing, entrant: normalizeEntrant(standing.entrant) };
}

export async function getUpcomingSets(
  eventSlug: string = STARTGG_EVENT_SLUG,
): Promise<StartggSet[]> {
  const sets = await fetchAllPages<StartggSet>(async (page) => {
    const data = await callStartGG<{
      event: {
        sets: { pageInfo: { totalPages: number }; nodes: StartggSet[] } | null;
      } | null;
    }>(UPCOMING_SETS_QUERY, { eventSlug, page, perPage: PER_PAGE });

    if (!data.event?.sets) return null;
    return { nodes: data.event.sets.nodes, totalPages: data.event.sets.pageInfo.totalPages };
  });
  return sets.map(normalizeSet);
}

export async function getCompletedSets(
  eventSlug: string = STARTGG_EVENT_SLUG,
): Promise<StartggSet[]> {
  const sets = await fetchAllPages<StartggSet>(async (page) => {
    const data = await callStartGG<{
      event: {
        sets: { pageInfo: { totalPages: number }; nodes: StartggSet[] } | null;
      } | null;
    }>(COMPLETED_SETS_QUERY, { eventSlug, page, perPage: PER_PAGE });

    if (!data.event?.sets) return null;
    return { nodes: data.event.sets.nodes, totalPages: data.event.sets.pageInfo.totalPages };
  });
  return sets.map(normalizeSet);
}

export async function getStandings(
  eventSlug: string = STARTGG_EVENT_SLUG,
): Promise<StartggStanding[]> {
  const standings = await fetchAllPages<StartggStanding>(async (page) => {
    const data = await callStartGG<{
      event: {
        standings: {
          pageInfo: { totalPages: number };
          nodes: StartggStanding[];
        } | null;
      } | null;
    }>(STANDINGS_QUERY, { eventSlug, page, perPage: PER_PAGE });

    if (!data.event?.standings) return null;
    return {
      nodes: data.event.standings.nodes,
      totalPages: data.event.standings.pageInfo.totalPages,
    };
  });
  return standings.map(normalizeStanding);
}

export async function getSetResult(setId: string): Promise<StartggSet | null> {
  const data = await callStartGG<{ set: StartggSet | null }>(SET_RESULT_QUERY, {
    setId,
  });
  return data.set ? normalizeSet(data.set) : null;
}

/** Palmarès (victoires/défaites) par joueur, calculé à partir des sets terminés. */
export interface PlayerRecord {
  entrant: StartggEntrant;
  wins: number;
  losses: number;
}

export function computeRecords(completedSets: StartggSet[]): Map<string, PlayerRecord> {
  const records = new Map<string, PlayerRecord>();

  const ensure = (entrant: StartggEntrant) => {
    let rec = records.get(entrant.id);
    if (!rec) {
      rec = { entrant, wins: 0, losses: 0 };
      records.set(entrant.id, rec);
    }
    return rec;
  };

  for (const set of completedSets) {
    if (set.winnerId == null) continue;
    for (const slot of set.slots) {
      if (!slot.entrant) continue;
      const rec = ensure(slot.entrant);
      if (String(set.winnerId) === slot.entrant.id) {
        rec.wins += 1;
      } else {
        rec.losses += 1;
      }
    }
  }

  return records;
}
