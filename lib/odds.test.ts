import { describe, expect, it } from "vitest";

import { computeMatchBetPayout, computeMatchOdds } from "./odds";

describe("computeMatchOdds", () => {
  it("gives the better-seeded player (favorite) the lower decimal odds", () => {
    const { oddsA, oddsB } = computeMatchOdds(1, 8); // A is the favorite (seed 1)
    expect(oddsA).toBeLessThan(oddsB);
    expect(oddsA).toBe(1.13); // (1+8)/8 = 1.125 -> 1.13
    expect(oddsB).toBe(9); // (1+8)/1 = 9
  });

  it("computes odds via exact cross-multiplication of the two seeds", () => {
    const { oddsA, oddsB } = computeMatchOdds(2, 3);
    expect(oddsA).toBe(1.67); // 5/3
    expect(oddsB).toBe(2.5); // 5/2
  });

  it("has no margin: 1/oddsA + 1/oddsB is (approximately, pre-rounding) 100%", () => {
    const { oddsA, oddsB } = computeMatchOdds(3, 5);
    expect(1 / oddsA + 1 / oddsB).toBeCloseTo(1, 2);
  });

  it("falls back to 50/50 odds when a seed is missing", () => {
    expect(computeMatchOdds(null, 4)).toEqual({ oddsA: 2, oddsB: 2 });
    expect(computeMatchOdds(4, null)).toEqual({ oddsA: 2, oddsB: 2 });
    expect(computeMatchOdds(null, null)).toEqual({ oddsA: 2, oddsB: 2 });
  });

  it("falls back to 50/50 odds when both seeds are equal", () => {
    expect(computeMatchOdds(5, 5)).toEqual({ oddsA: 2, oddsB: 2 });
  });

  it("falls back to 50/50 odds instead of dividing by zero for an invalid seed", () => {
    expect(computeMatchOdds(0, 4)).toEqual({ oddsA: 2, oddsB: 2 });
    expect(computeMatchOdds(4, 0)).toEqual({ oddsA: 2, oddsB: 2 });
    expect(computeMatchOdds(-1, 4)).toEqual({ oddsA: 2, oddsB: 2 });
  });
});

describe("computeMatchBetPayout", () => {
  it("pays stake x odds, rounded, when the bet won", () => {
    expect(computeMatchBetPayout({ won: true, stake: 100, odds: 1.9 })).toBe(190);
    expect(computeMatchBetPayout({ won: true, stake: 100, odds: 1.13 })).toBe(113);
  });

  it("pays nothing when the bet lost, regardless of stake/odds", () => {
    expect(computeMatchBetPayout({ won: false, stake: 500, odds: 9 })).toBe(0);
  });

  it("rounds to the nearest whole Ex", () => {
    expect(computeMatchBetPayout({ won: true, stake: 3, odds: 1.33 })).toBe(4); // 3.99 -> 4
  });
});
