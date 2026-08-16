import { describe, expect, it } from "vitest";

import { computeBracketResetPoints, computeMvcPoints, computeTop8PickPoints } from "./scoring";

describe("computeTop8PickPoints", () => {
  it("returns 0 for a null placement (still in / unresolved)", () => {
    expect(computeTop8PickPoints(null)).toBe(0);
  });

  it("weights points by real placement", () => {
    expect(computeTop8PickPoints(1)).toBe(10);
    expect(computeTop8PickPoints(2)).toBe(8);
    expect(computeTop8PickPoints(3)).toBe(6);
    expect(computeTop8PickPoints(4)).toBe(6);
    expect(computeTop8PickPoints(5)).toBe(3);
    expect(computeTop8PickPoints(8)).toBe(3);
  });

  it("returns 0 for a placement outside the top 8", () => {
    expect(computeTop8PickPoints(9)).toBe(0);
    expect(computeTop8PickPoints(33)).toBe(0);
  });
});

describe("computeMvcPoints", () => {
  it("awards the exact-match bonus only on an exact guess", () => {
    expect(computeMvcPoints(3, 3)).toBe(8);
  });

  it("awards nothing for an off-by-one guess (no degressive scale)", () => {
    expect(computeMvcPoints(2, 3)).toBe(0);
    expect(computeMvcPoints(4, 3)).toBe(0);
  });

  it("awards nothing while the result is unresolved", () => {
    expect(computeMvcPoints(3, null)).toBe(0);
  });
});

describe("computeBracketResetPoints", () => {
  it("awards points for a correct yes/no guess", () => {
    expect(computeBracketResetPoints(true, true)).toBe(4);
    expect(computeBracketResetPoints(false, false)).toBe(4);
  });

  it("awards nothing for a wrong guess", () => {
    expect(computeBracketResetPoints(true, false)).toBe(0);
    expect(computeBracketResetPoints(false, true)).toBe(0);
  });

  it("awards nothing while the result is unresolved", () => {
    expect(computeBracketResetPoints(true, null)).toBe(0);
  });
});
