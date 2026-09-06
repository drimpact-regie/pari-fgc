import { describe, expect, it } from "vitest";

import {
  abbreviateStageLabel,
  buildInvitationalBracketColumns,
  splitSection,
  type InvitationalBracketMatch,
} from "./invitationalBracket";

function match(overrides: Partial<InvitationalBracketMatch> & { id: string; orderIndex: number }): InvitationalBracketMatch {
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

describe("buildInvitationalBracketColumns", () => {
  it("groups matches into columns by groupLabel, in chronological order of first appearance", () => {
    const matches = [
      match({ id: "qf1", orderIndex: 1, groupLabel: "Quart de finale" }),
      match({ id: "qf2", orderIndex: 2, groupLabel: "Quart de finale" }),
      match({ id: "qf3", orderIndex: 3, groupLabel: "Quart de finale" }),
      match({ id: "qf4", orderIndex: 4, groupLabel: "Quart de finale" }),
      match({ id: "sf1", orderIndex: 5, groupLabel: "Demi-finale" }),
      match({ id: "sf2", orderIndex: 6, groupLabel: "Demi-finale" }),
      match({ id: "final", orderIndex: 7, groupLabel: "Finale" }),
    ];

    const columns = buildInvitationalBracketColumns(matches);

    expect(columns.map((c) => c.label)).toEqual(["Quart de finale", "Demi-finale", "Finale"]);
    expect(columns[0].matches.map((m) => m.id)).toEqual(["qf1", "qf2", "qf3", "qf4"]);
    expect(columns[1].matches.map((m) => m.id)).toEqual(["sf1", "sf2"]);
    expect(columns[2].matches.map((m) => m.id)).toEqual(["final"]);
  });

  it("sorts by orderIndex first, independent of input array order", () => {
    const matches = [
      match({ id: "b", orderIndex: 2, groupLabel: "Round 1" }),
      match({ id: "a", orderIndex: 1, groupLabel: "Round 1" }),
    ];
    const columns = buildInvitationalBracketColumns(matches);
    expect(columns[0].matches.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("falls back to a generic label for matches with no groupLabel (LIST format)", () => {
    const matches = [match({ id: "m1", orderIndex: 1, groupLabel: null })];
    const columns = buildInvitationalBracketColumns(matches);
    expect(columns).toHaveLength(1);
    expect(columns[0].label).toBe("Matchs");
  });
});

describe("splitSection", () => {
  it("extracts the section prefix before the ' — ' separator", () => {
    expect(splitSection("Poule D2 — Winners Round 1")).toEqual({ section: "Poule D2", roundLabel: "Winners Round 1" });
  });

  it("returns no section when the label has no separator", () => {
    expect(splitSection("Winners Round 1")).toEqual({ section: null, roundLabel: "Winners Round 1" });
  });
});

describe("abbreviateStageLabel", () => {
  it("leaves a label with no section prefix untouched", () => {
    expect(abbreviateStageLabel("Winners Round 1")).toBe("Winners Round 1");
    expect(abbreviateStageLabel("Grand Final")).toBe("Grand Final");
  });

  it("abbreviates only the round part of a section-prefixed label", () => {
    expect(abbreviateStageLabel("Poule D2 — Winners Round 1")).toBe("Poule D2 - WR1");
    expect(abbreviateStageLabel("Poule D1 — Losers Round 3")).toBe("Poule D1 - LR3");
    expect(abbreviateStageLabel("Top 8 — Grand Final Reset")).toBe("Top 8 - GFR");
    expect(abbreviateStageLabel("Top 8 — Grand Final")).toBe("Top 8 - GF");
    expect(abbreviateStageLabel("Top 8 — Winners Semi-Final")).toBe("Top 8 - WSF");
  });
});
