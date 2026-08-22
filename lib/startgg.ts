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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Nombre de tentatives supplémentaires en cas de 429 (limite de débit start.gg). */
const RATE_LIMIT_MAX_RETRIES = 2;

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

  for (let attempt = 0; ; attempt++) {
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

    if (res.status === 429 && attempt < RATE_LIMIT_MAX_RETRIES) {
      // start.gg limite le débit par token, pas par requête individuelle :
      // un pic de charge (plusieurs parieurs en même temps) peut déclencher
      // un 429 ponctuel qui se résorbe seul en quelques centaines de ms.
      // On respecte l'en-tête Retry-After s'il est fourni, sinon un backoff
      // court avant de réessayer plutôt que de faire échouer immédiatement
      // une action utilisateur (ex. placer un pari) pour un blocage transitoire.
      const retryAfterHeader = res.headers.get("Retry-After");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
      const backoffMs = Number.isFinite(retryAfterMs) ? retryAfterMs : 400 * 2 ** attempt;
      await sleep(backoffMs);
      continue;
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
  /** Tête de série de cet entrant pour la poule/phase de ce set (favori = plus petit nombre). */
  seedNum: number | null;
  /** Nombre de manches gagnées par cet entrant dans ce set, une fois terminé. */
  score: number | null;
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
  /** Format du set (Bo3 = 3, Bo5 = 5, ...), tel que configuré par l'organisateur. */
  totalGames: number | null;
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
  /**
   * Type de bracket start.gg pour cette étape (ex. "SINGLE_ELIMINATION",
   * "DOUBLE_ELIMINATION", "ROUND_ROBIN", "SWISS"...), null si non exposé —
   * sert au mode régie (lib/tournamentRegie.ts) pour choisir le format
   * Invitational équivalent. Valeurs de l'enum non vérifiées contre l'API
   * réelle depuis cet environnement (pas d'accès réseau sortant) ; à
   * confirmer sur la première activation en conditions réelles.
   */
  bracketType: string | null;
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
  /** Nom du jeu de l'event, sert à filtrer le roster de personnages (MVC). */
  videogameName: string | null;
}

// --- Requêtes GraphQL --------------------------------------------------------

const EVENT_INFO_QUERY = /* GraphQL */ `
  query EventInfo($eventSlug: String!) {
    event(slug: $eventSlug) {
      id
      name
      state
      numEntrants
      videogame {
        name
      }
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
          totalGames
          slots {
            entrant {
              id
              name
            }
            seed {
              seedNum
            }
            standing {
              stats {
                score {
                  value
                }
              }
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
          totalGames
          slots {
            entrant {
              id
              name
            }
            seed {
              seedNum
            }
            standing {
              stats {
                score {
                  value
                }
              }
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
        bracketType
      }
    }
  }
`;

/**
 * Meilleurs seeds toutes poules confondues, déduits de la seed de la
 * première phase de l'event (celle attribuée à l'inscription, avant
 * répartition en poules où le seed redevient local à chaque poule).
 */
const EVENT_TOP_SEEDS_QUERY = /* GraphQL */ `
  query EventTopSeeds($eventSlug: String!, $perPage: Int!) {
    event(slug: $eventSlug) {
      phases {
        id
        seeds(query: { perPage: $perPage, page: 1 }) {
          nodes {
            seedNum
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

/**
 * Liste brute des inscrits à l'event, indépendamment du classement/bracket.
 * Contrairement à `standings` (rempli seulement une fois des sets terminés),
 * `entrants` est disponible dès la clôture des inscriptions — sert à
 * permettre les pronostics Top 8 avant même que le bracket ait démarré.
 */
const EVENT_ENTRANTS_QUERY = /* GraphQL */ `
  query EventEntrants($eventSlug: String!, $page: Int!, $perPage: Int!) {
    event(slug: $eventSlug) {
      entrants(query: { perPage: $perPage, page: $page }) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          name
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
      round
      fullRoundText
      state
      winnerId
      totalGames
      slots {
        entrant {
          id
          name
        }
        seed {
          seedNum
        }
        standing {
          stats {
            score {
              value
            }
          }
        }
      }
    }
  }
`;

// --- Pagination --------------------------------------------------------------

const MAX_PAGES = 5;
const PER_PAGE = 50;

/**
 * `truncated` est vrai si l'event avait plus de pages que MAX_PAGES n'en a
 * parcouru — càd que tous les sets n'ont pas pu être récupérés. Pour un
 * grand tournoi (poules + bracket cumulant plus de MAX_PAGES*PER_PAGE sets
 * terminés), ça peut faire disparaître silencieusement des sets de fin de
 * bracket (Losers Final, Grande Finale...) de la liste retournée — voir
 * getCompletedSetsWithTruncation, qui s'en sert pour rattraper au cas par
 * cas les sets pariés manquants plutôt que de les laisser bloqués en
 * attente indéfiniment.
 */
async function fetchAllPages<TNode>(
  fetchPage: (page: number) => Promise<{ nodes: TNode[]; totalPages: number } | null>,
): Promise<{ nodes: TNode[]; truncated: boolean }> {
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
  return { nodes: all, truncated: totalPages > MAX_PAGES };
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
      videogame: { name: string } | null;
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
    videogameName: data.event.videogame?.name ?? null,
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
    event: {
      phases: { id: string | number; name: string; bracketType: string | null }[] | null;
    } | null;
  }>(EVENT_PHASES_QUERY, { eventSlug });

  return (data.event?.phases ?? []).map((p) => ({
    id: String(p.id),
    name: p.name,
    bracketType: p.bracketType,
  }));
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
  slots: {
    entrant: RawStartggEntrant | null;
    seed: { seedNum: number } | null;
    standing: { stats: { score: { value: number | null } | null } | null } | null;
  }[];
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
    slots: set.slots.map((slot) => ({
      entrant: normalizeEntrant(slot.entrant),
      seedNum: slot.seed?.seedNum ?? null,
      score: slot.standing?.stats?.score?.value ?? null,
    })),
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
  const { nodes } = await fetchAllPages<RawStartggSet>(async (page) => {
    const data = await callStartGG<{
      event: {
        sets: { pageInfo: { totalPages: number }; nodes: RawStartggSet[] } | null;
      } | null;
    }>(UPCOMING_SETS_QUERY, { eventSlug, page, perPage: PER_PAGE });

    if (!data.event?.sets) return null;
    return { nodes: data.event.sets.nodes, totalPages: data.event.sets.pageInfo.totalPages };
  });
  // Exclus dès la source les matchs "prévisionnels" (voir isPreviewSetId) :
  // ni la sidebar, ni la liste des rounds, ni le pari chat ne doivent
  // jamais les proposer comme pariables, sous peine de créer des paris
  // orphelins qui ne pourront jamais se résoudre.
  return nodes.map(normalizeSet).filter((set) => !isPreviewSetId(set.id));
}

/**
 * Comme getCompletedSets, mais expose aussi si la pagination a été
 * tronquée (event avec plus de sets terminés que MAX_PAGES*PER_PAGE n'en
 * couvre) — sert à resolveAllPendingBets (lib/matchResults.ts) pour savoir
 * s'il faut rattraper individuellement un set parié qui n'apparaît pas
 * dans la liste, plutôt que de conclure à tort qu'il n'est pas terminé.
 */
export async function getCompletedSetsWithTruncation(
  eventSlug: string = STARTGG_EVENT_SLUG,
): Promise<{ sets: StartggSet[]; truncated: boolean }> {
  const { nodes, truncated } = await fetchAllPages<RawStartggSet>(async (page) => {
    const data = await callStartGG<{
      event: {
        sets: { pageInfo: { totalPages: number }; nodes: RawStartggSet[] } | null;
      } | null;
    }>(COMPLETED_SETS_QUERY, { eventSlug, page, perPage: PER_PAGE });

    if (!data.event?.sets) return null;
    return { nodes: data.event.sets.nodes, totalPages: data.event.sets.pageInfo.totalPages };
  });
  return { sets: nodes.map(normalizeSet).filter((set) => !isPreviewSetId(set.id)), truncated };
}

export async function getCompletedSets(
  eventSlug: string = STARTGG_EVENT_SLUG,
): Promise<StartggSet[]> {
  const { sets } = await getCompletedSetsWithTruncation(eventSlug);
  return sets;
}

export async function getStandings(
  eventSlug: string = STARTGG_EVENT_SLUG,
): Promise<StartggStanding[]> {
  const { nodes } = await fetchAllPages<RawStartggStanding>(async (page) => {
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
  return nodes.map(normalizeStanding);
}

/**
 * Liste des inscrits à l'event (indépendante du classement) — disponible dès
 * la clôture des inscriptions, avant même que le bracket ne soit lancé.
 * Sert de source pour les pronostics Top 8 pendant que `getStandings` est
 * encore vide (voir EVENT_ENTRANTS_QUERY).
 */
export async function getEventEntrants(
  eventSlug: string = STARTGG_EVENT_SLUG,
): Promise<StartggEntrant[]> {
  const { nodes } = await fetchAllPages<RawStartggEntrant>(async (page) => {
    const data = await callStartGG<{
      event: {
        entrants: { pageInfo: { totalPages: number }; nodes: RawStartggEntrant[] } | null;
      } | null;
    }>(EVENT_ENTRANTS_QUERY, { eventSlug, page, perPage: PER_PAGE });

    if (!data.event?.entrants) return null;
    return { nodes: data.event.entrants.nodes, totalPages: data.event.entrants.pageInfo.totalPages };
  });
  return nodes.map((entrant) => normalizeEntrant(entrant)).filter((e): e is StartggEntrant => e !== null);
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

/**
 * Meilleurs seeds (têtes de série) de plusieurs poules en une seule requête
 * GraphQL (via alias, un champ `phaseGroup` par poule) plutôt qu'une requête
 * par poule. Une page "Round 1" avec des dizaines de poules déclenchait
 * auparavant autant de requêtes start.gg en parallèle qu'il y a de poules à
 * chaque chargement de page — assez pour déclencher un 429 (limite de débit
 * par token, pas par requête) dès que plusieurs parieurs chargeaient la page
 * en même temps. Ne fait rien si `phaseGroupIds` est vide.
 */
export async function getPhaseGroupsTopSeeds(
  phaseGroupIds: string[],
  limit = 4,
): Promise<Map<string, StartggSeed[]>> {
  if (phaseGroupIds.length === 0) return new Map();

  const query = `
    query BatchPhaseGroupSeeds(${phaseGroupIds.map((_, i) => `$id${i}: ID!`).join(", ")}, $perPage: Int!) {
      ${phaseGroupIds
        .map(
          (_, i) => `
      g${i}: phaseGroup(id: $id${i}) {
        seeds(query: { perPage: $perPage, page: 1 }) {
          nodes {
            seedNum
            entrant {
              name
            }
          }
        }
      }`,
        )
        .join("\n")}
    }
  `;
  const variables: Record<string, unknown> = { perPage: Math.max(limit, 8) };
  phaseGroupIds.forEach((id, i) => {
    variables[`id${i}`] = id;
  });

  const data = await callStartGG<
    Record<
      string,
      { seeds: { nodes: { seedNum: number; entrant: { name: string } | null }[] } | null } | null
    >
  >(query, variables);

  const result = new Map<string, StartggSeed[]>();
  phaseGroupIds.forEach((id, i) => {
    const nodes = data[`g${i}`]?.seeds?.nodes ?? [];
    result.set(
      id,
      nodes
        .filter((n): n is { seedNum: number; entrant: { name: string } } => n.entrant !== null)
        .sort((a, b) => a.seedNum - b.seedNum)
        .slice(0, limit)
        .map((n) => ({ seedNum: n.seedNum, entrantName: n.entrant.name })),
    );
  });
  return result;
}

/**
 * Identifiants des `limit` meilleurs seeds du tournoi (toutes poules
 * confondues), déduits de la toute première étape de l'event — c'est celle
 * qui reflète le seed d'ensemble attribué à l'inscription, avant que les
 * joueurs ne soient répartis en poules (dont le seed local n'est pas
 * comparable d'une poule à l'autre). Sert à repérer les matchs de favoris
 * à mettre en avant avant le Top 24 (voir isNotableMatch).
 *
 * ⚠️ Champ `phase.seeds` non vérifié en conditions réelles (pas d'accès
 * réseau start.gg depuis cet environnement) — à confirmer une fois
 * déployé : si la première phase de l'event n'est pas la bonne source de
 * seed d'ensemble pour un tournoi donné, cette liste peut être vide ou
 * incomplète (dans ce cas isNotableMatch retombe simplement sur le
 * périmètre Top 24, sans planter).
 */
export async function getEventTopSeedEntrantIds(
  eventSlug: string = STARTGG_EVENT_SLUG,
  limit = 16,
): Promise<Set<string>> {
  const data = await callStartGG<{
    event: {
      phases: {
        id: string | number;
        seeds: {
          nodes: { seedNum: number; entrant: { id: string | number; name: string } | null }[];
        } | null;
      }[] | null;
    } | null;
  }>(EVENT_TOP_SEEDS_QUERY, { eventSlug, perPage: Math.max(limit, 8) });

  const firstPhase = data.event?.phases?.[0];
  const nodes = firstPhase?.seeds?.nodes ?? [];
  return new Set(
    nodes
      .filter(
        (n): n is { seedNum: number; entrant: { id: string | number; name: string } } =>
          n.entrant !== null,
      )
      .sort((a, b) => a.seedNum - b.seedNum)
      .slice(0, limit)
      .map((n) => String(n.entrant.id)),
  );
}

/**
 * Détecte un reset de bracket en grande finale : start.gg génère un set
 * séparé ("Grand Final Reset") uniquement quand le joueur venant du loser
 * bracket a gagné le premier set de la grande finale. Retourne null si on
 * ne peut pas encore savoir (grande finale pas jouée/pas terminée) plutôt
 * que de deviner — sert à pré-remplir la saisie admin, pas à la remplacer.
 */
export function detectBracketReset(completedSets: StartggSet[]): boolean | null {
  const grandFinal = completedSets.find(
    (set) => /grand final(?!s? reset)/i.test(set.fullRoundText) && set.winnerId != null,
  );
  if (!grandFinal) return null;

  const reset = completedSets.find(
    (set) => /grand final.*reset/i.test(set.fullRoundText) && set.winnerId != null,
  );
  return reset !== undefined;
}

/**
 * Le pari MVC se verrouille "une étape avant le top 8" : on cherche le plus
 * petit "Top N" (N > 8) présent dans les rounds de l'event (ex. Top 16,
 * Top 24, Top 32 selon la taille du bracket) et on verrouille dès qu'un set
 * de ce round a démarré. S'il n'existe aucun round "Top N" intermédiaire
 * (petit bracket qui va direct au top 8), on retombe sur `topEightLocked`.
 */
export function isMvcLocked(allSets: StartggSet[], topEightLocked: boolean): boolean {
  let cutoffRound: number | null = null;
  for (const set of allSets) {
    const match = /^top (\d+)$/i.exec(set.fullRoundText.trim());
    if (!match) continue;
    const n = Number(match[1]);
    if (n > 8 && (cutoffRound === null || n < cutoffRound)) {
      cutoffRound = n;
    }
  }

  if (cutoffRound === null) return topEightLocked;

  return allSets.some(
    (set) =>
      /^top (\d+)$/i.exec(set.fullRoundText.trim())?.[1] === String(cutoffRound) &&
      set.state !== SET_STATE.NOT_STARTED,
  );
}

/**
 * Vrai si ce round fait partie des phases finales tardives du bracket : un
 * "Top N" (N <= cutoff) ou la grande finale (et son éventuel reset). Même
 * convention que isMvcLocked/detectBracketReset ci-dessus — généralisée sur
 * le libellé de round que start.gg génère lui-même selon la progression du
 * bracket plutôt que sur un nom de round en dur, donc valable quelle que
 * soit la taille de l'event (Top 32, Top 24 ou Top 16 qui mènent au Top 8).
 */
export function isLateBracketRound(fullRoundText: string, cutoff = 24): boolean {
  const text = fullRoundText.trim();
  if (/grand final/i.test(text)) return true;
  const match = /^top (\d+)$/i.exec(text);
  return match !== null && Number(match[1]) <= cutoff;
}

/**
 * Vrai si cet identifiant de set est un match "prévisionnel" (bracket pas
 * encore réellement généré côté start.gg — aperçu affiché avant que les
 * poules/le bracket ne soient créés). Repérable au préfixe "preview_" de
 * l'id (un vrai set a un id purement numérique) ; ces sets renvoient aussi
 * systématiquement un fullRoundText vide. Un tel id n'est PAS une véritable
 * ressource "Set" interrogeable plus tard côté start.gg : y parier crée un
 * pari qui ne pourra jamais se résoudre automatiquement, faute de match
 * réel à retrouver (voir resolveAllPendingBets dans lib/matchResults.ts,
 * qui annule directement ces paris plutôt que d'attendre indéfiniment).
 */
export function isPreviewSetId(setId: string): boolean {
  return setId.startsWith("preview_");
}

/**
 * Vrai si ce set est réellement ouvert au pari : pas encore commencé, les
 * deux entrants sont connus (sinon on attend encore le résultat d'un match
 * précédent pour savoir qui y jouera), et ce n'est pas un match prévisionnel
 * (voir isPreviewSetId) qui ne deviendra jamais un vrai match résolvable.
 */
export function isSetOpenForBetting(set: StartggSet): boolean {
  return (
    set.state === SET_STATE.NOT_STARTED &&
    set.slots.filter((slot) => slot.entrant !== null).length === 2 &&
    !isPreviewSetId(set.id)
  );
}

/**
 * Comme isLateBracketRound, mais vérifie aussi le nom de la PHASE (pas
 * seulement le libellé de round de chaque set) : certains tournois
 * affichent "Top N" comme nom de phase (event.phases[].name / phaseName,
 * visible en en-tête de section sur /matches) plutôt que dans le
 * fullRoundText de chaque set individuel, qui peut alors rester "Winners
 * Final", "Round 1"... au sein de cette phase. Sans ce repli, ces sets ne
 * matchaient jamais isLateBracketRound malgré une phase "Top 8" clairement
 * affichée juste à côté — cause probable du bug "sidebar toujours vide"
 * alors que des matchs sont visiblement ouverts dans la liste principale.
 */
export function isLateBracketSet(
  set: Pick<StartggSet, "fullRoundText" | "phaseName">,
  cutoff = 24,
): boolean {
  return (
    isLateBracketRound(set.fullRoundText, cutoff) ||
    isLateBracketRound(set.phaseName ?? "", cutoff)
  );
}

/**
 * Vrai si ce match implique au moins un des meilleurs seeds du tournoi
 * (toutes poules confondues) OU fait partie des phases finales tardives
 * (voir isLateBracketSet) — sert à décider quels matchs mettre en avant
 * (sidebar "Paris ouverts", annonces de résultat en chat) avant le Top 24 :
 * le reste du bracket à ce stade (poules, Round 1/2/3...) n'a pas besoin
 * d'être mis en avant, mais les matchs des favoris restent suivis même en
 * poules.
 */
export function isNotableMatch(
  set: Pick<StartggSet, "fullRoundText" | "phaseName" | "slots">,
  topSeedEntrantIds: ReadonlySet<string>,
  cutoff = 24,
): boolean {
  if (isLateBracketSet(set, cutoff)) return true;
  return set.slots.some((slot) => slot.entrant != null && topSeedEntrantIds.has(slot.entrant.id));
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
