import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  detectBracketReset,
  getEventEntrantDetails,
  getEventPhases,
  getUpcomingSets,
  getUpcomingSetsIncludingPreviews,
  isLateBracketRound,
  isLateBracketSet,
  isMvcLocked,
  isNotableMatch,
  isPreviewSetId,
  isSetOpenForBetting,
  SET_STATE,
  StartggApiError,
  tournamentSlugFromEventSlug,
  type StartggEntrant,
  type StartggSet,
} from "./startgg";

function makeSet(overrides: Partial<StartggSet>): StartggSet {
  return {
    id: "1",
    round: 1,
    fullRoundText: "Round 1",
    state: SET_STATE.NOT_STARTED,
    winnerId: null,
    slots: [],
    totalGames: null,
    phaseGroupId: null,
    poolLabel: null,
    phaseId: null,
    phaseName: null,
    ...overrides,
  };
}

function makeEntrant(id: string): StartggEntrant {
  return { id, name: `Entrant ${id}`, playerId: null };
}

describe("detectBracketReset", () => {
  it("returns null when the grand final hasn't been played yet", () => {
    expect(detectBracketReset([makeSet({ fullRoundText: "Winners Final", winnerId: 1 })])).toBeNull();
  });

  it("returns null when the grand final exists but isn't completed", () => {
    expect(detectBracketReset([makeSet({ fullRoundText: "Grand Final", winnerId: null })])).toBeNull();
  });

  it("returns false when the grand final is completed with no reset set", () => {
    expect(detectBracketReset([makeSet({ fullRoundText: "Grand Final", winnerId: 1 })])).toBe(false);
  });

  it("returns true when a completed Grand Final Reset set exists", () => {
    const sets = [
      makeSet({ fullRoundText: "Grand Final", winnerId: 1 }),
      makeSet({ fullRoundText: "Grand Final Reset", winnerId: 2 }),
    ];
    expect(detectBracketReset(sets)).toBe(true);
  });

  it("does not count an unfinished reset set as a confirmed reset", () => {
    const sets = [
      makeSet({ fullRoundText: "Grand Final", winnerId: 1 }),
      makeSet({ fullRoundText: "Grand Final Reset", winnerId: null }),
    ];
    expect(detectBracketReset(sets)).toBe(false);
  });
});

describe("isMvcLocked", () => {
  it("falls back to topEightLocked when no intermediate Top N round exists", () => {
    const sets = [makeSet({ fullRoundText: "Top 8" })];
    expect(isMvcLocked(sets, false)).toBe(false);
    expect(isMvcLocked(sets, true)).toBe(true);
  });

  it("stays unlocked while the round before top 8 hasn't started", () => {
    const sets = [
      makeSet({ fullRoundText: "Top 16", state: SET_STATE.NOT_STARTED }),
      makeSet({ fullRoundText: "Top 8", state: SET_STATE.NOT_STARTED }),
    ];
    expect(isMvcLocked(sets, false)).toBe(false);
  });

  it("locks once any set in the round before top 8 has started", () => {
    const sets = [
      makeSet({ fullRoundText: "Top 16", state: SET_STATE.STARTED }),
      makeSet({ fullRoundText: "Top 8", state: SET_STATE.NOT_STARTED }),
    ];
    expect(isMvcLocked(sets, false)).toBe(true);
  });

  it("picks the smallest Top N above 8 as the cutoff round (e.g. Top 24, not Top 8)", () => {
    const sets = [
      makeSet({ fullRoundText: "Top 32", state: SET_STATE.COMPLETED }),
      makeSet({ fullRoundText: "Top 24", state: SET_STATE.NOT_STARTED }),
      makeSet({ fullRoundText: "Top 8", state: SET_STATE.NOT_STARTED }),
    ];
    // Top 32 already happened, but the cutoff is Top 24 (closest to top 8) and
    // it hasn't started yet, so betting should still be open.
    expect(isMvcLocked(sets, false)).toBe(false);
  });
});

describe("isLateBracketRound", () => {
  it("includes Top N at or below the cutoff", () => {
    expect(isLateBracketRound("Top 24")).toBe(true);
    expect(isLateBracketRound("Top 8")).toBe(true);
    expect(isLateBracketRound("Top 6")).toBe(true);
    expect(isLateBracketRound("top 2")).toBe(true);
  });

  it("excludes Top N above the cutoff", () => {
    expect(isLateBracketRound("Top 32")).toBe(false);
    expect(isLateBracketRound("Top 192")).toBe(false);
  });

  it("respects a custom cutoff", () => {
    expect(isLateBracketRound("Top 32", 32)).toBe(true);
    expect(isLateBracketRound("Top 48", 32)).toBe(false);
  });

  it("always includes the Grand Final and its reset, regardless of cutoff", () => {
    expect(isLateBracketRound("Grand Final")).toBe(true);
    expect(isLateBracketRound("Grand Final Reset")).toBe(true);
  });

  it("excludes early rounds and pools", () => {
    expect(isLateBracketRound("Winners Round 1")).toBe(false);
    expect(isLateBracketRound("Losers Round 3")).toBe(false);
    expect(isLateBracketRound("Round 1 Pools")).toBe(false);
  });
});

describe("isSetOpenForBetting", () => {
  it("is open when not started and both entrants are known", () => {
    const set = makeSet({
      state: SET_STATE.NOT_STARTED,
      slots: [
        { entrant: makeEntrant("1"), seedNum: 1, score: null },
        { entrant: makeEntrant("2"), seedNum: 2, score: null },
      ],
    });
    expect(isSetOpenForBetting(set)).toBe(true);
  });

  it("is not open when one entrant is still TBD (waiting on a previous match)", () => {
    const set = makeSet({
      state: SET_STATE.NOT_STARTED,
      slots: [
        { entrant: makeEntrant("1"), seedNum: 1, score: null },
        { entrant: null, seedNum: null, score: null },
      ],
    });
    expect(isSetOpenForBetting(set)).toBe(false);
  });

  it("is not open once the set has started or completed", () => {
    const slots = [
      { entrant: makeEntrant("1"), seedNum: 1, score: null },
      { entrant: makeEntrant("2"), seedNum: 2, score: null },
    ];
    expect(isSetOpenForBetting(makeSet({ state: SET_STATE.STARTED, slots }))).toBe(false);
    expect(isSetOpenForBetting(makeSet({ state: SET_STATE.COMPLETED, slots }))).toBe(false);
  });

  it("is not open when the set is a start.gg preview match (bracket not really generated yet)", () => {
    const set = makeSet({
      id: "preview_3415169_3_1",
      state: SET_STATE.NOT_STARTED,
      slots: [
        { entrant: makeEntrant("1"), seedNum: 1, score: null },
        { entrant: makeEntrant("2"), seedNum: 2, score: null },
      ],
    });
    expect(isSetOpenForBetting(set)).toBe(false);
  });
});

describe("isPreviewSetId", () => {
  it("recognizes the preview_ prefix used by start.gg's bracket-preview placeholder matches", () => {
    expect(isPreviewSetId("preview_3415169_3_1")).toBe(true);
    expect(isPreviewSetId("preview_3407472_1_4")).toBe(true);
  });

  it("does not flag a real, numeric start.gg set id", () => {
    expect(isPreviewSetId("3948572")).toBe(false);
  });
});

describe("isLateBracketSet", () => {
  it("matches on fullRoundText alone, like isLateBracketRound", () => {
    expect(isLateBracketSet(makeSet({ fullRoundText: "Top 8", phaseName: null }))).toBe(true);
    expect(isLateBracketSet(makeSet({ fullRoundText: "Round 1 Pools", phaseName: null }))).toBe(
      false,
    );
  });

  it("also matches when only the phase name (not the set's own round label) says Top N — some tournaments label the phase 'Top 8' while individual sets still read 'Winners Final'/'Round 1'", () => {
    const set = makeSet({ fullRoundText: "Winners Final", phaseName: "Top 8" });
    expect(isLateBracketRound(set.fullRoundText)).toBe(false); // the old, narrower check misses this
    expect(isLateBracketSet(set)).toBe(true);
  });

  it("excludes early rounds whose phase name is also early (e.g. pools)", () => {
    const set = makeSet({ fullRoundText: "Round 1", phaseName: "Poules" });
    expect(isLateBracketSet(set)).toBe(false);
  });
});

describe("isNotableMatch", () => {
  it("includes any open Top-24+ match regardless of seed", () => {
    const set = makeSet({
      fullRoundText: "Top 8",
      slots: [
        { entrant: makeEntrant("1"), seedNum: 5, score: null },
        { entrant: makeEntrant("2"), seedNum: 6, score: null },
      ],
    });
    expect(isNotableMatch(set, new Set())).toBe(true);
  });

  it("excludes an early-round match when neither entrant is a top seed", () => {
    const set = makeSet({
      fullRoundText: "Round 1 Pools",
      phaseName: "Poules",
      slots: [
        { entrant: makeEntrant("40"), seedNum: 40, score: null },
        { entrant: makeEntrant("41"), seedNum: 41, score: null },
      ],
    });
    expect(isNotableMatch(set, new Set(["1", "2", "3"]))).toBe(false);
  });

  it("includes an early-round match when at least one entrant is a top seed", () => {
    const set = makeSet({
      fullRoundText: "Round 1 Pools",
      phaseName: "Poules",
      slots: [
        { entrant: makeEntrant("1"), seedNum: 1, score: null },
        { entrant: makeEntrant("42"), seedNum: 42, score: null },
      ],
    });
    expect(isNotableMatch(set, new Set(["1"]))).toBe(true);
  });
});

describe("tournamentSlugFromEventSlug", () => {
  it("strips the /event/... suffix", () => {
    expect(tournamentSlugFromEventSlug("tournament/ceo-2026/event/marvel-tokon-fighting-souls")).toBe(
      "tournament/ceo-2026",
    );
  });

  it("returns the input unchanged when there is no /event/ segment", () => {
    expect(tournamentSlugFromEventSlug("tournament/ceo-2026")).toBe("tournament/ceo-2026");
  });
});

/**
 * Régression pour le 429 rencontré à l'activation du mode régie
 * (lib/tournamentRegie.ts) : callStartGG (privé, exercé ici via
 * getEventPhases — la plus simple de ses appelantes, une seule requête sans
 * pagination) doit absorber un 429 transitoire tout seul, et transmettre le
 * code HTTP quand la limite persiste au-delà des tentatives automatiques,
 * pour que l'appelant puisse distinguer ce cas (réessayer aide) d'une vraie
 * panne.
 */
describe("callStartGG retry/backoff on 429 (exercé via getEventPhases)", () => {
  const originalToken = process.env.STARTGG_TOKEN;

  beforeEach(() => {
    process.env.STARTGG_TOKEN = "test-token";
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env.STARTGG_TOKEN = originalToken;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("retries a transient 429 and eventually succeeds", async () => {
    const rateLimited = new Response("rate limited", { status: 429 });
    const ok = new Response(
      JSON.stringify({
        data: { event: { phases: [{ id: 1, name: "Bracket", bracketType: "SINGLE_ELIMINATION" }] } },
      }),
      { status: 200 },
    );
    const fetchMock = vi.fn().mockResolvedValueOnce(rateLimited).mockResolvedValueOnce(ok);
    vi.stubGlobal("fetch", fetchMock);

    const promise = getEventPhases("tournament/x/event/y");
    await vi.runAllTimersAsync();
    const phases = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(phases).toEqual([{ id: "1", name: "Bracket", bracketType: "SINGLE_ELIMINATION" }]);
  });

  it("gives up after exhausting retries and surfaces a StartggApiError carrying the 429 status", async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response("rate limited", { status: 429, statusText: "Too Many Requests" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = getEventPhases("tournament/x/event/y").catch((err) => err);
    await vi.runAllTimersAsync();
    const err = await promise;

    expect(err).toBeInstanceOf(StartggApiError);
    expect((err as StartggApiError).status).toBe(429);
    // Au moins un essai initial + une tentative automatique — la valeur
    // exacte (RATE_LIMIT_MAX_RETRIES + 1) est un détail d'implémentation de
    // callStartGG, pas la garantie testée ici.
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });
});

/**
 * Support de plusieurs tokens start.gg (STARTGG_TOKEN, STARTGG_TOKEN_2...) —
 * chacun son propre budget de débit chez start.gg, voir le commentaire de
 * callStartGG. STARTGG_TOKEN_2 est optionnel ; ces tests couvrent le
 * comportement une fois qu'il est renseigné, en plus du cas mono-token déjà
 * couvert par le describe ci-dessus (comportement inchangé sans lui).
 */
describe("callStartGG avec plusieurs tokens (STARTGG_TOKEN_2)", () => {
  const originalToken = process.env.STARTGG_TOKEN;
  const originalToken2 = process.env.STARTGG_TOKEN_2;

  beforeEach(() => {
    process.env.STARTGG_TOKEN = "test-token-1";
    process.env.STARTGG_TOKEN_2 = "test-token-2";
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env.STARTGG_TOKEN = originalToken;
    process.env.STARTGG_TOKEN_2 = originalToken2;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function authHeaderOf(call: unknown[]): string | undefined {
    const init = call[1] as RequestInit | undefined;
    return (init?.headers as Record<string, string> | undefined)?.Authorization;
  }

  it("switches to the other configured token immediately on a 429, without waiting for backoff", async () => {
    const rateLimited = new Response("rate limited", { status: 429 });
    const ok = new Response(
      JSON.stringify({ data: { event: { phases: [] } } }),
      { status: 200 },
    );
    const fetchMock = vi.fn().mockResolvedValueOnce(rateLimited).mockResolvedValueOnce(ok);
    vi.stubGlobal("fetch", fetchMock);

    // Pas de vi.runAllTimersAsync() ici : la bascule immédiate vers l'autre
    // token ne doit déclencher aucune vraie attente (contrairement au repli
    // en backoff, exercé par le describe précédent).
    const phases = await getEventPhases("tournament/x/event/y");

    expect(phases).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = fetchMock.mock.calls;
    expect(authHeaderOf(firstCall)).not.toBe(authHeaderOf(secondCall));
    expect([authHeaderOf(firstCall), authHeaderOf(secondCall)].sort()).toEqual([
      "Bearer test-token-1",
      "Bearer test-token-2",
    ]);
  });

  it("still backs off once every configured token has been tried without success in a round", async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response("rate limited", { status: 429, statusText: "Too Many Requests" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = getEventPhases("tournament/x/event/y").catch((err) => err);
    await vi.runAllTimersAsync();
    const err = await promise;

    expect(err).toBeInstanceOf(StartggApiError);
    expect((err as StartggApiError).status).toBe(429);
    // Les deux tokens ont bien été essayés (pas juste le premier en boucle).
    const usedTokens = new Set(fetchMock.mock.calls.map((call) => authHeaderOf(call)));
    expect(usedTokens).toEqual(new Set(["Bearer test-token-1", "Bearer test-token-2"]));
  });

  it("spreads successive independent calls across both tokens, not just the first one", async () => {
    const ok = () =>
      Promise.resolve(new Response(JSON.stringify({ data: { event: { phases: [] } } }), { status: 200 }));
    const fetchMock = vi.fn().mockImplementation(ok);
    vi.stubGlobal("fetch", fetchMock);

    await getEventPhases("tournament/x/event/y");
    await getEventPhases("tournament/x/event/y");

    const usedTokens = new Set(fetchMock.mock.calls.map((call) => authHeaderOf(call)));
    expect(usedTokens).toEqual(new Set(["Bearer test-token-1", "Bearer test-token-2"]));
  });
});

/**
 * Régression pour le "0 match" à l'activation du mode régie sur un bracket
 * pas encore "démarré" côté start.gg : tant que l'organisateur n'a pas
 * cliqué sur "Start", TOUS ses sets — y compris un Round 1 déjà entièrement
 * seedé avec de vrais entrants — sont renvoyés avec un id "preview_", que
 * getUpcomingSets exclut (à raison, pour le pari). getUpcomingSetsIncludingPreviews
 * (réservée au mode régie) doit, elle, les garder.
 */
describe("getUpcomingSets vs getUpcomingSetsIncludingPreviews", () => {
  const originalToken = process.env.STARTGG_TOKEN;

  function rawSetNode(overrides: { id: string; fullRoundText?: string }) {
    return {
      id: overrides.id,
      round: 1,
      fullRoundText: overrides.fullRoundText ?? "Winners Round 1",
      state: 1,
      winnerId: null,
      totalGames: 3,
      slots: [
        { entrant: { id: "1", name: "Alice" }, seed: { seedNum: 1 }, standing: null },
        { entrant: { id: "2", name: "Bob" }, seed: { seedNum: 64 }, standing: null },
      ],
      phaseGroup: null,
    };
  }

  beforeEach(() => {
    process.env.STARTGG_TOKEN = "test-token";
  });

  afterEach(() => {
    process.env.STARTGG_TOKEN = originalToken;
    vi.unstubAllGlobals();
  });

  function mockOnePageOfSets(nodes: ReturnType<typeof rawSetNode>[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ data: { event: { sets: { pageInfo: { totalPages: 1 }, nodes } } } }),
          { status: 200 },
        ),
      ),
    );
  }

  it("getUpcomingSets drops preview_ sets, even a fully-seeded not-yet-started Round 1", async () => {
    mockOnePageOfSets([rawSetNode({ id: "preview_123" }), rawSetNode({ id: "456" })]);

    const sets = await getUpcomingSets("tournament/x/event/y");

    expect(sets.map((s) => s.id)).toEqual(["456"]);
  });

  it("getUpcomingSetsIncludingPreviews keeps them, for the régie import's own use", async () => {
    mockOnePageOfSets([rawSetNode({ id: "preview_123" }), rawSetNode({ id: "456" })]);

    const sets = await getUpcomingSetsIncludingPreviews("tournament/x/event/y");

    expect(sets.map((s) => s.id)).toEqual(["preview_123", "456"]);
  });
});

/**
 * Préremplissage tag/pays du mode régie (lib/tournamentRegie.ts) depuis la
 * fiche start.gg de chaque entrant — voir StartggEntrantDetails.
 */
describe("getEventEntrantDetails", () => {
  const originalToken = process.env.STARTGG_TOKEN;

  beforeEach(() => {
    process.env.STARTGG_TOKEN = "test-token";
  });

  afterEach(() => {
    process.env.STARTGG_TOKEN = originalToken;
    vi.unstubAllGlobals();
  });

  function mockOnePageOfEntrants(nodes: unknown[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ data: { event: { entrants: { pageInfo: { totalPages: 1 }, nodes } } } }),
          { status: 200 },
        ),
      ),
    );
  }

  it("reads the per-event prefix as the tag, and a 2-letter location.country as the country code", async () => {
    mockOnePageOfEntrants([
      {
        id: "1",
        participants: [{ prefix: "AOE", player: { prefix: "OLD", user: { location: { country: "FR" } } } }],
      },
    ]);

    const details = await getEventEntrantDetails("tournament/x/event/y");

    expect(details).toEqual([{ id: "1", tag: "AOE", countryCode: "FR" }]);
  });

  it("falls back to the player's default prefix when the per-event one is empty", async () => {
    mockOnePageOfEntrants([{ id: "1", participants: [{ prefix: null, player: { prefix: "DEFAULT", user: null } }] }]);

    const details = await getEventEntrantDetails("tournament/x/event/y");

    expect(details[0]).toMatchObject({ tag: "DEFAULT" });
  });

  it("ignores a country value that isn't a clean 2-letter code (e.g. a full country name)", async () => {
    mockOnePageOfEntrants([
      { id: "1", participants: [{ prefix: null, player: { prefix: null, user: { location: { country: "France" } } } }] },
    ]);

    const details = await getEventEntrantDetails("tournament/x/event/y");

    expect(details[0]).toMatchObject({ countryCode: null });
  });

  it("defaults to null tag/countryCode when an entrant has no participant data at all", async () => {
    mockOnePageOfEntrants([{ id: "1", participants: null }]);

    const details = await getEventEntrantDetails("tournament/x/event/y");

    expect(details).toEqual([{ id: "1", tag: null, countryCode: null }]);
  });
});
