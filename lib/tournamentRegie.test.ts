import { describe, expect, it } from "vitest";

import type { StartggSet } from "./startgg";
import {
  buildRegieMatchesFromSets,
  mapBracketTypeToInvitationalFormat,
  pickRegiePhase,
} from "./tournamentRegie";

function makeSet(overrides: Partial<StartggSet> & { id: string }): StartggSet {
  return {
    round: 1,
    fullRoundText: "Round 1",
    state: 1,
    winnerId: null,
    slots: [],
    totalGames: 3,
    phaseGroupId: null,
    poolLabel: null,
    phaseId: "phase1",
    phaseName: "Bracket",
    ...overrides,
  };
}

function slot(name: string | null) {
  return { entrant: name ? { id: name, name, playerId: null } : null, seedNum: null, score: null };
}

describe("mapBracketTypeToInvitationalFormat", () => {
  it("maps known start.gg bracket types", () => {
    expect(mapBracketTypeToInvitationalFormat("SINGLE_ELIMINATION")).toBe("BRACKET_SINGLE");
    expect(mapBracketTypeToInvitationalFormat("DOUBLE_ELIMINATION")).toBe("BRACKET_DOUBLE");
    expect(mapBracketTypeToInvitationalFormat("ROUND_ROBIN")).toBe("ROUND_ROBIN");
    expect(mapBracketTypeToInvitationalFormat("SWISS")).toBe("SWISS");
  });

  it("falls back to LIST for unknown/null bracket types", () => {
    expect(mapBracketTypeToInvitationalFormat(null)).toBe("LIST");
    expect(mapBracketTypeToInvitationalFormat("CUSTOM_SCHEDULE")).toBe("LIST");
  });
});

describe("pickRegiePhase", () => {
  it("returns null when there are no phases", () => {
    expect(pickRegiePhase([])).toBeNull();
  });

  it("picks the last phase (final bracket, after any pools)", () => {
    const phases = [
      { id: "1", name: "Pools", bracketType: "ROUND_ROBIN" },
      { id: "2", name: "Top 8", bracketType: "DOUBLE_ELIMINATION" },
    ];
    expect(pickRegiePhase(phases)?.id).toBe("2");
  });
});

describe("buildRegieMatchesFromSets", () => {
  it("orders single-elimination rounds by round number and fills TBD placeholders", () => {
    const sets: StartggSet[] = [
      makeSet({ id: "sf", round: 2, fullRoundText: "Final", slots: [slot(null), slot(null)] }),
      makeSet({ id: "qf1", round: 1, fullRoundText: "Round 1", slots: [slot("Alice"), slot("Bob")] }),
      makeSet({ id: "qf2", round: 1, fullRoundText: "Round 1", slots: [slot("Carl"), slot("Dana")] }),
    ];

    const matches = buildRegieMatchesFromSets(sets);

    expect(matches.map((m) => m.groupLabel)).toEqual(["Round 1", "Round 1", "Final"]);
    expect(matches[0]).toMatchObject({ orderIndex: 0, competitorA: { name: "Alice" }, competitorB: { name: "Bob" } });
    expect(matches[1]).toMatchObject({ orderIndex: 1, competitorA: { name: "Carl" }, competitorB: { name: "Dana" } });
    expect(matches[2].competitorA).toBeNull();
    expect(matches[2].placeholderA).toContain("Final");
  });

  it("orders double-elimination as winners, losers, grand final, then grand final reset", () => {
    const sets: StartggSet[] = [
      makeSet({ id: "gfr", round: 4, fullRoundText: "Grand Final Reset", slots: [slot("Alice"), slot("Carl")] }),
      makeSet({ id: "gf", round: 4, fullRoundText: "Grand Final", slots: [slot("Alice"), slot("Carl")] }),
      makeSet({ id: "l1", round: -1, fullRoundText: "Losers Round 1", slots: [slot("Bob"), slot("Dana")] }),
      makeSet({ id: "w1", round: 1, fullRoundText: "Winners Round 1", slots: [slot("Alice"), slot("Bob")] }),
      makeSet({ id: "w2", round: 2, fullRoundText: "Winners Final", slots: [slot("Alice"), slot("Carl")] }),
    ];

    const matches = buildRegieMatchesFromSets(sets);

    expect(matches.map((m) => m.groupLabel)).toEqual([
      "Winners Round 1",
      "Winners Final",
      "Losers Round 1",
      "Grand Final",
      "Grand Final Reset",
    ]);
    // orderIndex doit être global (strictement croissant across rounds), pas
    // remis à zéro à chaque round — sinon buildInvitationalBracketColumns
    // (qui trie tous les matchs par orderIndex pour ordonner les colonnes)
    // ne peut plus distinguer "Winners Round 1" de "Grand Final Reset" et
    // affiche les colonnes dans un ordre arbitraire.
    expect(matches.map((m) => m.orderIndex)).toEqual([0, 1, 2, 3, 4]);
  });
});
