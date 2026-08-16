import { describe, expect, it } from "vitest";

import { buildBracketLayout } from "./bracket";
import { SET_STATE, type StartggSet } from "./startgg";

let nextId = 1;

function makeSet(overrides: Partial<StartggSet>): StartggSet {
  return {
    id: String(nextId++),
    round: 1,
    fullRoundText: "Winners Final",
    state: SET_STATE.NOT_STARTED,
    winnerId: null,
    slots: [],
    totalGames: null,
    phaseGroupId: null,
    poolLabel: null,
    phaseId: null,
    phaseName: "Top 8",
    ...overrides,
  };
}

describe("buildBracketLayout", () => {
  it("groups a full 8-player double-elim bracket into the expected columns, in bracket order", () => {
    const sets = [
      makeSet({ round: 3, fullRoundText: "Winners Semi-Final" }), // A
      makeSet({ round: 3, fullRoundText: "Winners Semi-Final" }), // B
      makeSet({ round: 4, fullRoundText: "Winners Final" }), // C
      makeSet({ round: 5, fullRoundText: "Grand Final" }), // D
      makeSet({ round: -1, fullRoundText: "Losers Round 1" }), // F
      makeSet({ round: -1, fullRoundText: "Losers Round 1" }), // G
      makeSet({ round: -2, fullRoundText: "Losers Quarter-Final" }), // H
      makeSet({ round: -2, fullRoundText: "Losers Quarter-Final" }), // I
      makeSet({ round: -3, fullRoundText: "Losers Semi-Final" }), // J
      makeSet({ round: -4, fullRoundText: "Losers Final" }), // K
    ];

    const layout = buildBracketLayout(sets);

    expect(layout.winners.map((c) => [c.label, c.sets.length])).toEqual([
      ["Winners Semi-Final", 2],
      ["Winners Final", 1],
    ]);
    expect(layout.grandFinal.map((c) => c.label)).toEqual(["Grand Final"]);
    // Losers Round 1 (-1) first, Losers Final (-4) last — closest to 0 goes first.
    expect(layout.losers.map((c) => [c.label, c.sets.length])).toEqual([
      ["Losers Round 1", 2],
      ["Losers Quarter-Final", 2],
      ["Losers Semi-Final", 1],
      ["Losers Final", 1],
    ]);
  });

  it("keeps Grand Final Reset after Grand Final regardless of round gaps", () => {
    const sets = [
      makeSet({ round: 6, fullRoundText: "Grand Final Reset" }),
      makeSet({ round: 5, fullRoundText: "Grand Final" }),
    ];
    expect(buildBracketLayout(sets).grandFinal.map((c) => c.label)).toEqual([
      "Grand Final",
      "Grand Final Reset",
    ]);
  });

  it("returns empty columns when there are no winners/losers/grand final sets", () => {
    expect(buildBracketLayout([])).toEqual({ winners: [], grandFinal: [], losers: [] });
  });
});
