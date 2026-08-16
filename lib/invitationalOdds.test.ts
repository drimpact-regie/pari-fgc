import { describe, expect, it } from "vitest";

import { computeStreakOdds } from "./invitationalOdds";

describe("computeStreakOdds", () => {
  it("gives base odds 1.90/1.90 for a fresh match with no streak on either side", () => {
    expect(computeStreakOdds(0, 0)).toEqual({ oddsA: 1.9, oddsB: 1.9 });
  });

  it("drops the streaking player's odds by 0.10 per consecutive win, mirrored on the opponent", () => {
    expect(computeStreakOdds(1, 0)).toEqual({ oddsA: 1.8, oddsB: 2.0 });
    expect(computeStreakOdds(2, 0)).toEqual({ oddsA: 1.7, oddsB: 2.1 });
    expect(computeStreakOdds(3, 0)).toEqual({ oddsA: 1.6, oddsB: 2.2 });
  });

  it("floors the favorite's odds at 1.25 regardless of how long the streak is", () => {
    expect(computeStreakOdds(10, 0).oddsA).toBe(1.25);
    expect(computeStreakOdds(20, 0).oddsA).toBe(1.25);
  });

  it("caps the underdog's odds at 3.00 regardless of how long the opponent's streak is", () => {
    expect(computeStreakOdds(15, 0).oddsB).toBe(3.0);
    expect(computeStreakOdds(20, 0).oddsB).toBe(3.0);
  });

  it("accounts for both competitors' own streaks when they each come in on a run", () => {
    // A has a 2-win streak, B has a 1-win streak of their own (from other matches
    // in the same event) — the net edge is (2-1) = 1 step in favor of A.
    expect(computeStreakOdds(2, 1)).toEqual({ oddsA: 1.8, oddsB: 2.0 });
  });

  it("is symmetric: equal streaks on both sides cancel out back to base odds", () => {
    expect(computeStreakOdds(3, 3)).toEqual({ oddsA: 1.9, oddsB: 1.9 });
  });

  it("mirrors correctly when B is the one on a streak instead of A", () => {
    expect(computeStreakOdds(0, 2)).toEqual({ oddsA: 2.1, oddsB: 1.7 });
  });
});
