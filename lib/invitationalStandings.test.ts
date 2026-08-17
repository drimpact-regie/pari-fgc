import { describe, expect, it } from "vitest";

import { computeStandings } from "./invitationalStandings";

describe("computeStandings", () => {
  const competitors = [
    { id: "alice", name: "Alice", tag: "RZA" },
    { id: "bob", name: "Bob", tag: null },
    { id: "chloe", name: "Chloe", tag: null },
    { id: "david", name: "David", tag: null },
  ];

  it("counts wins/losses only from COMPLETED matches with a winner", () => {
    const matches = [
      { competitorAId: "alice", competitorBId: "bob", winnerId: "alice", status: "COMPLETED" as const },
      { competitorAId: "chloe", competitorBId: "david", winnerId: "chloe", status: "COMPLETED" as const },
      { competitorAId: "alice", competitorBId: "chloe", winnerId: "alice", status: "COMPLETED" as const },
      { competitorAId: "bob", competitorBId: "david", winnerId: null, status: "OPEN" as const },
    ];

    const standings = computeStandings(matches, competitors);

    expect(standings[0]).toMatchObject({ competitorId: "alice", wins: 2, losses: 0 });
    expect(standings.find((r) => r.competitorId === "bob")).toMatchObject({ wins: 0, losses: 1 });
    expect(standings.find((r) => r.competitorId === "chloe")).toMatchObject({ wins: 1, losses: 1 });
    expect(standings.find((r) => r.competitorId === "david")).toMatchObject({ wins: 0, losses: 1 });
  });

  it("sorts by wins desc, then losses asc, then name", () => {
    const matches = [
      { competitorAId: "alice", competitorBId: "bob", winnerId: "alice", status: "COMPLETED" as const },
      { competitorAId: "alice", competitorBId: "chloe", winnerId: "alice", status: "COMPLETED" as const },
      { competitorAId: "bob", competitorBId: "david", winnerId: "bob", status: "COMPLETED" as const },
    ];
    const standings = computeStandings(matches, competitors);
    expect(standings.map((r) => r.competitorId)).toEqual(["alice", "bob", "chloe", "david"]);
  });

  it("includes competitors with zero matches played", () => {
    const standings = computeStandings([], competitors);
    expect(standings).toHaveLength(4);
    expect(standings.every((r) => r.wins === 0 && r.losses === 0)).toBe(true);
  });
});
