import { describe, expect, it } from "vitest";

import { formatMatchResultMessage, type CompletedMatchAnnouncement } from "./matchResults";

function makeResult(overrides: Partial<CompletedMatchAnnouncement>): CompletedMatchAnnouncement {
  return {
    winnerName: "Sonicfox",
    loserName: "Supernoon",
    winnerScore: 3,
    loserScore: 1,
    ...overrides,
  };
}

describe("formatMatchResultMessage", () => {
  it("formats a single result with the score", () => {
    expect(formatMatchResultMessage([makeResult({})])).toBe(
      "Sonicfox a gagné 3-1 contre Supernoon !",
    );
  });

  it("falls back to no score when it's missing", () => {
    expect(
      formatMatchResultMessage([makeResult({ winnerScore: null, loserScore: null })]),
    ).toBe("Sonicfox a gagné contre Supernoon !");
  });

  it("falls back to no score when only one side is missing", () => {
    expect(formatMatchResultMessage([makeResult({ loserScore: null })])).toBe(
      "Sonicfox a gagné contre Supernoon !",
    );
  });

  it("groups multiple simultaneous results into one anti-flood message", () => {
    const results = [
      makeResult({ winnerName: "Sonicfox", loserName: "Supernoon", winnerScore: 3, loserScore: 1 }),
      makeResult({ winnerName: "Player3", loserName: "Player4", winnerScore: 3, loserScore: 0 }),
    ];
    expect(formatMatchResultMessage(results)).toBe(
      "Résultats : Sonicfox a gagné 3-1 contre Supernoon | Player3 a gagné 3-0 contre Player4 !",
    );
  });
});
