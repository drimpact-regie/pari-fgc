import { describe, expect, it } from "vitest";

import {
  detectBracketReset,
  isLateBracketRound,
  isLateBracketSet,
  isMvcLocked,
  isNotableMatch,
  isPreviewSetId,
  isSetOpenForBetting,
  SET_STATE,
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
