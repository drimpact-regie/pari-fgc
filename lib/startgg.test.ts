import { describe, expect, it } from "vitest";

import { detectBracketReset, isMvcLocked, SET_STATE, type StartggSet } from "./startgg";

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
