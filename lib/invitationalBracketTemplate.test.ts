import { describe, expect, it } from "vitest";

import { buildTemplatedBracketColumns, getBracketTemplate } from "./invitationalBracketTemplate";
import type { InvitationalBracketMatch } from "./invitationalBracket";

function makeMatch(overrides: Partial<InvitationalBracketMatch> & { id: string; orderIndex: number }): InvitationalBracketMatch {
  return {
    groupLabel: null,
    competitorA: null,
    placeholderA: null,
    competitorB: null,
    placeholderB: null,
    status: "NOT_OPEN",
    winnerId: null,
    competitorAId: null,
    competitorBId: null,
    scoreA: null,
    scoreB: null,
    ...overrides,
  };
}

describe("getBracketTemplate", () => {
  it("builds a single-elimination template with plain round names and no losers/final columns", () => {
    const template = getBracketTemplate("BRACKET_SINGLE", 8);
    expect(template.map((c) => c.label)).toEqual(["Quarter-Final", "Semi-Final", "Final"]);
    expect(template.map((c) => c.matchSlots)).toEqual([4, 2, 1]);
    expect(template.every((c) => c.side === "winners")).toBe(true);
  });

  it("builds a double-elimination template with Winners/Losers/Grand Final columns", () => {
    const template = getBracketTemplate("BRACKET_DOUBLE", 8);
    expect(template.map((c) => c.label)).toEqual([
      "Winners Quarter-Final",
      "Winners Semi-Final",
      "Winners Final",
      "Losers Round 1",
      "Losers Round 2",
      "Losers Round 3",
      "Losers Final",
      "Grand Final",
      "Grand Final Reset",
    ]);
    expect(template.map((c) => c.matchSlots)).toEqual([4, 2, 1, 2, 2, 1, 1, 1, 1]);
  });

  it("names every winners round distinctly for a larger bracket (16)", () => {
    const template = getBracketTemplate("BRACKET_DOUBLE", 16);
    const winnersLabels = template.filter((c) => c.side === "winners").map((c) => c.label);
    expect(winnersLabels).toEqual(["Winners Round of 16", "Winners Quarter-Final", "Winners Semi-Final", "Winners Final"]);
  });

  it("scales the losers bracket size correctly for 16 and 32", () => {
    const t16 = getBracketTemplate("BRACKET_DOUBLE", 16);
    expect(t16.filter((c) => c.side === "losers").map((c) => c.matchSlots)).toEqual([4, 4, 2, 2, 1, 1]);

    const t32 = getBracketTemplate("BRACKET_DOUBLE", 32);
    expect(t32.filter((c) => c.side === "losers").map((c) => c.matchSlots)).toEqual([8, 8, 4, 4, 2, 2, 1, 1]);
  });

  it("always ends a double-elimination template with Grand Final then Grand Final Reset", () => {
    for (const size of [8, 16, 32] as const) {
      const template = getBracketTemplate("BRACKET_DOUBLE", size);
      expect(template.at(-2)?.label).toBe("Grand Final");
      expect(template.at(-1)?.label).toBe("Grand Final Reset");
    }
  });
});

describe("buildTemplatedBracketColumns", () => {
  it("fills matched columns from imported matches, in groupLabel-first-appearance order", () => {
    const matches: InvitationalBracketMatch[] = [
      makeMatch({ id: "qf1", orderIndex: 1, groupLabel: "Round 1" }),
      makeMatch({ id: "qf2", orderIndex: 2, groupLabel: "Round 1" }),
      makeMatch({ id: "qf3", orderIndex: 3, groupLabel: "Round 1" }),
      makeMatch({ id: "qf4", orderIndex: 4, groupLabel: "Round 1" }),
      makeMatch({ id: "sf1", orderIndex: 5, groupLabel: "Round 2" }),
    ];
    const columns = buildTemplatedBracketColumns(matches, "BRACKET_SINGLE", 8);
    expect(columns[0].label).toBe("Quarter-Final");
    expect(columns[0].matches.map((m) => m?.id ?? null)).toEqual(["qf1", "qf2", "qf3", "qf4"]);
    expect(columns[1].label).toBe("Semi-Final");
    // Un seul match importé pour ce round sur les 2 attendus : le second slot reste vide (null).
    expect(columns[1].matches.map((m) => m?.id ?? null)).toEqual(["sf1", null]);
    expect(columns[2].label).toBe("Final");
    expect(columns[2].matches).toEqual([null]);
  });

  it("leaves an entirely un-imported round as all-null slots without dropping the column", () => {
    const matches: InvitationalBracketMatch[] = [
      makeMatch({ id: "qf1", orderIndex: 1, groupLabel: "Round 1" }),
      makeMatch({ id: "qf2", orderIndex: 2, groupLabel: "Round 1" }),
      makeMatch({ id: "qf3", orderIndex: 3, groupLabel: "Round 1" }),
      makeMatch({ id: "qf4", orderIndex: 4, groupLabel: "Round 1" }),
    ];
    const columns = buildTemplatedBracketColumns(matches, "BRACKET_SINGLE", 8);
    expect(columns).toHaveLength(3);
    expect(columns[1].matches).toEqual([null, null]);
    expect(columns[2].matches).toEqual([null]);
  });
});
