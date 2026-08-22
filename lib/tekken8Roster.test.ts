import { describe, expect, it } from "vitest";

import { TEKKEN8_ROSTER } from "./tekken8Roster";

describe("TEKKEN8_ROSTER", () => {
  it("has no duplicate or blank names", () => {
    expect(new Set(TEKKEN8_ROSTER).size).toBe(TEKKEN8_ROSTER.length);
    expect(TEKKEN8_ROSTER.every((name) => name.trim().length > 0)).toBe(true);
  });
});
