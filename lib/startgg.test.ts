import { describe, expect, it } from "vitest";

import {
  detectBracketReset,
  isLateBracketRound,
  isMvcLocked,
  isSetOpenForBetting,
  SET_STATE,
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
});
