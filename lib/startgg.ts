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
  /** Identifiant joueur stable (participants.player.id), pour croiser son historique. */
  playerId: string | null;
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
  /** Identifiant de la poule/phaseGroup start.gg à laquelle ce set appartient. */
  phaseGroupId: string | null;
  /** Identifiant affiché de la poule (ex: "A", "1"), quand il y en a plusieurs en parallèle. */
  poolLabel: string | null;
  /** Étape/bracket start.gg (ex: "Round 1 Pools", "Top 192", "Bracket final"). */
  phaseId: string | null;
  phaseName: string | null;
}

export interface StartggSeed {
  seedNum: number;
  entrantName: string;
}

/**
 * Une "phase" côté start.gg = un bracket/étape du tournoi (poules, top 192,
 * bracket final, etc.). Un event peut en avoir plusieurs selon son
 * avancement — récupérées indépendamment des sets pour pouvoir afficher les
 * étapes à venir même avant que start.gg n'y ait généré le moindre match.
 */
export interface StartggPhase {
  id: string;
  name: string;
}

export interface StartggStanding {
  placement: number | null;
  entrant: StartggEntrant | null;
}

/** Un résultat passé d'un joueur sur un tournoi (palmarès). */
export interface PlayerHistoryEntry {
  placement: number | null;
  eventName: string;
  tournamentName: string;
  tournamentLogoUrl: string | null;
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
          phaseGroup {
            id
            displayIdentifier
            phase {
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
          phaseGroup {
            id
            displayIdentifier
            phase {
              id
              name
            }
          }
        }
      }
    }
  }
`;

/** Liste des étapes/brackets de l'event, indépendamment des sets déjà générés. */
const EVENT_PHASES_QUERY = /* GraphQL */ `
  query EventPhases($eventSlug: String!) {
    event(slug: $eventSlug) {
      phases {
        id
        name
      }
    }
  }
`;

/** Meilleurs seeds (têtes de série) d'une poule/phaseGroup start.gg. */
const PHASE_GROUP_SEEDS_QUERY = /* GraphQL */ `
  query PhaseGroupSeeds($phaseGroupId: ID!, $perPage: Int!) {
    phaseGroup(id: $phaseGroupId) {
      seeds(query: { perPage: $perPage, page: 1 }) {
        nodes {
          seedNum
          entrant {
            name
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
            participants {
              player {
                id
              }
            }
          }
        }
      }
    }
  }
`;

/** Historique récent d'un joueur (tous tournois start.gg confondus) — sert au palmarès. */
const PLAYER_RECENT_STANDINGS_QUERY = /* GraphQL */ `
  query PlayerRecentStandings($playerId: ID!, $limit: Int!) {
    player(id: $playerId) {
      recentStandings(limit: $limit) {
        placement
        entrant {
          event {
            name
            tournament {
              name
              images {
                url
                type
              }
            }
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
 * Liste toutes les étapes/brackets de l'event dans l'ordre défini par
 * start.gg, y compris celles pas encore ouvertes (aucun set généré) — sert
 * à afficher l'agenda complet du tournoi plutôt que seulement l'étape en
 * cours.
 */
export async function getEventPhases(
  eventSlug: string = STARTGG_EVENT_SLUG,
): Promise<StartggPhase[]> {
  const data = await callStartGG<{
    event: { phases: { id: string | number; name: string }[] | null } | null;
  }>(EVENT_PHASES_QUERY, { eventSlug });

  return (data.event?.phases ?? []).map((p) => ({ id: String(p.id), name: p.name }));
}

/** Forme brute d'un entrant telle que renvoyée par l'API (avant normalisation). */
interface RawStartggEntrant {
  id: string | number;
  name: string;
  participants?: { player: { id: string | number } | null }[] | null;
}

/**
 * L'API start.gg renvoie `entrant.id` (et `set.id`) en tant que nombre côté
 * JSON, alors qu'on les manipule comme des chaînes partout dans l'app
 * (formulaires, validation Zod, clés Prisma). On normalise donc en string
 * dès la sortie de l'API pour éviter tout mismatch de type en aval.
 */
function normalizeEntrant(entrant: RawStartggEntrant | null): StartggEntrant | null {
  if (!entrant) return null;
  const playerId = entrant.participants?.[0]?.player?.id;
  return {
    id: String(entrant.id),
    name: entrant.name,
    playerId: playerId != null ? String(playerId) : null,
  };
}

/** Forme brute d'un set telle que renvoyée par l'API (avant normalisation). */
interface RawStartggSet
  extends Omit<StartggSet, "phaseGroupId" | "poolLabel" | "phaseId" | "phaseName" | "slots"> {
  slots: { entrant: RawStartggEntrant | null }[];
  phaseGroup: {
    id: string | number;
    displayIdentifier: string | null;
    phase: { id: string | number; name: string } | null;
  } | null;
}

function normalizeSet(set: RawStartggSet): StartggSet {
  return {
    ...set,
    id: String(set.id),
    slots: set.slots.map((slot) => ({ entrant: normalizeEntrant(slot.entrant) })),
    phaseGroupId: set.phaseGroup ? String(set.phaseGroup.id) : null,
    poolLabel: set.phaseGroup?.displayIdentifier || null,
    phaseId: set.phaseGroup?.phase ? String(set.phaseGroup.phase.id) : null,
    phaseName: set.phaseGroup?.phase?.name ?? null,
  };
}

interface RawStartggStanding {
  placement: number | null;
  entrant: RawStartggEntrant | null;
}

function normalizeStanding(standing: RawStartggStanding): StartggStanding {
  return { placement: standing.placement, entrant: normalizeEntrant(standing.entrant) };
}

export async function getUpcomingSets(
  eventSlug: string = STARTGG_EVENT_SLUG,
): Promise<StartggSet[]> {
  const sets = await fetchAllPages<RawStartggSet>(async (page) => {
    const data = await callStartGG<{
      event: {
        sets: { pageInfo: { totalPages: number }; nodes: RawStartggSet[] } | null;
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
  const sets = await fetchAllPages<RawStartggSet>(async (page) => {
    const data = await callStartGG<{
      event: {
        sets: { pageInfo: { totalPages: number }; nodes: RawStartggSet[] } | null;
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
  const standings = await fetchAllPages<RawStartggStanding>(async (page) => {
    const data = await callStartGG<{
      event: {
        standings: {
          pageInfo: { totalPages: number };
          nodes: RawStartggStanding[];
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

/**
 * Palmarès d'un joueur: ses N derniers résultats de tournoi côté start.gg
 * (tous tournois confondus, pas seulement ceux suivis par l'app). Nécessite
 * le playerId stable (participants.player.id), pas l'entrantId (qui change
 * à chaque tournoi).
 */
export async function getPlayerRecentStandings(
  playerId: string,
  limit = 5,
): Promise<PlayerHistoryEntry[]> {
  interface RawTournament {
    name: string;
    images: { url: string; type: string | null }[] | null;
  }
  const data = await callStartGG<{
    player: {
      recentStandings: {
        placement: number | null;
        entrant: {
          event: { name: string; tournament: RawTournament | null } | null;
        } | null;
      }[] | null;
    } | null;
  }>(PLAYER_RECENT_STANDINGS_QUERY, { playerId, limit });

  return (data.player?.recentStandings ?? [])
    .filter((s): s is typeof s & { entrant: { event: { name: string; tournament: RawTournament | null } } } =>
      s.entrant?.event != null,
    )
    .map((s) => {
      const images = s.entrant.event.tournament?.images ?? [];
      const logo = images.find((img) => img.type === "profile") ?? images[0] ?? null;
      return {
        placement: s.placement,
        eventName: s.entrant.event.name,
        tournamentName: s.entrant.event.tournament?.name ?? "",
        tournamentLogoUrl: logo?.url ?? null,
      };
    });
}

export async function getSetResult(setId: string): Promise<StartggSet | null> {
  const data = await callStartGG<{ set: RawStartggSet | null }>(SET_RESULT_QUERY, {
    setId,
  });
  return data.set ? normalizeSet(data.set) : null;
}

/** Meilleurs seeds (têtes de série) d'une poule, triés du meilleur au moins bon. */
export async function getPhaseGroupTopSeeds(
  phaseGroupId: string,
  limit = 4,
): Promise<StartggSeed[]> {
  const data = await callStartGG<{
    phaseGroup: {
      seeds: { nodes: { seedNum: number; entrant: { name: string } | null }[] } | null;
    } | null;
  }>(PHASE_GROUP_SEEDS_QUERY, { phaseGroupId, perPage: Math.max(limit, 8) });

  const nodes = data.phaseGroup?.seeds?.nodes ?? [];
  return nodes
    .filter((n): n is { seedNum: number; entrant: { name: string } } => n.entrant !== null)
    .sort((a, b) => a.seedNum - b.seedNum)
    .slice(0, limit)
    .map((n) => ({ seedNum: n.seedNum, entrantName: n.entrant.name }));
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
