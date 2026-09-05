import { describe, expect, it } from "vitest";

import type { StartggPhase, StartggSet } from "./startgg";
import {
  buildRegieMatchesFromPhases,
  buildRegieMatchesFromSets,
  mapBracketTypeToInvitationalFormat,
  regieOverallFormat,
  type RegiePhaseSets,
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

function makePhase(overrides: Partial<StartggPhase> & { id: string }): StartggPhase {
  return { name: "Phase", bracketType: null, ...overrides };
}

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

describe("buildRegieMatchesFromPhases", () => {
  it("leaves labels unprefixed and reuses buildRegieMatchesFromSets ordering for a single phase", () => {
    const pools = makePhase({ id: "pools", name: "Poules", bracketType: "ROUND_ROBIN" });
    const phasesWithSets: RegiePhaseSets[] = [
      {
        phase: pools,
        sets: [
          makeSet({ id: "p1", phaseId: "pools", round: 1, fullRoundText: "Round 1", slots: [slot("Alice"), slot("Bob")] }),
        ],
      },
    ];

    const matches = buildRegieMatchesFromPhases(phasesWithSets);

    expect(matches.map((m) => m.groupLabel)).toEqual(["Round 1"]);
  });

  it("prefixes group labels with the phase name once several phases contribute matches", () => {
    const pools = makePhase({ id: "pools", name: "Poules", bracketType: "ROUND_ROBIN" });
    const bracket = makePhase({ id: "bracket", name: "Bracket", bracketType: "DOUBLE_ELIMINATION" });
    const phasesWithSets: RegiePhaseSets[] = [
      {
        phase: pools,
        sets: [
          makeSet({ id: "p1", phaseId: "pools", round: 1, fullRoundText: "Pool A", slots: [slot("Alice"), slot("Bob")] }),
        ],
      },
      {
        phase: bracket,
        sets: [
          makeSet({ id: "b1", phaseId: "bracket", round: 1, fullRoundText: "Winners Round 1", slots: [slot("Alice"), slot("Carl")] }),
        ],
      },
    ];

    const matches = buildRegieMatchesFromPhases(phasesWithSets);

    expect(matches.map((m) => m.groupLabel)).toEqual(["Poules — Pool A", "Bracket — Winners Round 1"]);
    // orderIndex reste global sur l'ensemble des étapes, pas remis à zéro à
    // la deuxième étape — même raison que dans buildRegieMatchesFromSets.
    expect(matches.map((m) => m.orderIndex)).toEqual([0, 1]);
  });

  it("skips phases without any generated set entirely (not yet seeded)", () => {
    const pools = makePhase({ id: "pools", name: "Poules", bracketType: "ROUND_ROBIN" });
    const bracket = makePhase({ id: "bracket", name: "Bracket", bracketType: "DOUBLE_ELIMINATION" });
    const phasesWithSets: RegiePhaseSets[] = [
      {
        phase: pools,
        sets: [
          makeSet({ id: "p1", phaseId: "pools", round: 1, fullRoundText: "Pool A", slots: [slot("Alice"), slot("Bob")] }),
        ],
      },
      { phase: bracket, sets: [] },
    ];

    const matches = buildRegieMatchesFromPhases(phasesWithSets);

    // Une seule étape a effectivement des matchs : pas de préfixe, comme un
    // event mono-étape (le bracket pas encore seedé ne doit pas polluer les
    // libellés de la seule étape déjà disponible).
    expect(matches.map((m) => m.groupLabel)).toEqual(["Pool A"]);
  });
});

describe("regieOverallFormat", () => {
  it("uses the single phase's format when only one phase has matches", () => {
    const bracket = makePhase({ id: "bracket", name: "Bracket", bracketType: "DOUBLE_ELIMINATION" });
    const phasesWithSets: RegiePhaseSets[] = [{ phase: bracket, sets: [makeSet({ id: "b1" })] }];

    expect(regieOverallFormat(phasesWithSets)).toBe("BRACKET_DOUBLE");
  });

  it("keeps the shared bracket format when a bracket is split across several same-type phases", () => {
    const top64 = makePhase({ id: "top64", name: "Top 64", bracketType: "DOUBLE_ELIMINATION" });
    const top8 = makePhase({ id: "top8", name: "Top 8", bracketType: "DOUBLE_ELIMINATION" });
    const phasesWithSets: RegiePhaseSets[] = [
      { phase: top64, sets: [makeSet({ id: "s1" })] },
      { phase: top8, sets: [makeSet({ id: "s2" })] },
    ];

    expect(regieOverallFormat(phasesWithSets)).toBe("BRACKET_DOUBLE");
  });

  it("falls back to LIST when pools and bracket phases (different types) both have matches", () => {
    const pools = makePhase({ id: "pools", name: "Poules", bracketType: "ROUND_ROBIN" });
    const bracket = makePhase({ id: "bracket", name: "Bracket", bracketType: "DOUBLE_ELIMINATION" });
    const phasesWithSets: RegiePhaseSets[] = [
      { phase: pools, sets: [makeSet({ id: "p1" })] },
      { phase: bracket, sets: [makeSet({ id: "b1" })] },
    ];

    expect(regieOverallFormat(phasesWithSets)).toBe("LIST");
  });

  it("ignores phases without matches when checking for a shared type", () => {
    const pools = makePhase({ id: "pools", name: "Poules", bracketType: "ROUND_ROBIN" });
    const bracket = makePhase({ id: "bracket", name: "Bracket", bracketType: "DOUBLE_ELIMINATION" });
    const phasesWithSets: RegiePhaseSets[] = [
      { phase: pools, sets: [] },
      { phase: bracket, sets: [makeSet({ id: "b1" })] },
    ];

    expect(regieOverallFormat(phasesWithSets)).toBe("BRACKET_DOUBLE");
  });
});
