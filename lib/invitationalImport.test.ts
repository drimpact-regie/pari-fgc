import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { buildCompetitorRoster, InvitationalImportError, parseInvitationalWorkbook } from "./invitationalImport";

function makeWorkbookBuffer(sheets: Record<string, unknown[][]>): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

const MATCH_HEADER = ["Groupe", "Ordre", "Joueur A", "Tag A", "Pays A", "Joueur B", "Tag B", "Pays B"];

describe("parseInvitationalWorkbook — bracket format", () => {
  it("parses a bracket-format .xlsx with Info + Matchs sheets", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "BRACKET_SINGLE"]],
      Matchs: [
        MATCH_HEADER,
        ["Winners Semi-Final", 1, "SonicFox", "Fly", "US", "Leffen", "TSM", "SE"],
        ["Winners Semi-Final", 2, "Kayos", "", "US", "Punk", "", "US"],
        ["Winners Final", 3, "SonicFox", "Fly", "US", "Kayos", "", "US"],
      ],
    });

    const result = parseInvitationalWorkbook(buffer, "bracket.xlsx");

    expect(result.format).toBe("BRACKET_SINGLE");
    expect(result.matches).toHaveLength(3);
    expect(result.matches[0]).toEqual({
      groupLabel: "Winners Semi-Final",
      orderIndex: 1,
      competitorA: { name: "SonicFox", tag: "Fly", countryCode: "US" },
      competitorB: { name: "Leffen", tag: "TSM", countryCode: "SE" },
    });
    // Empty tag/country cells become null, not empty strings.
    expect(result.matches[1].competitorA).toEqual({ name: "Kayos", tag: null, countryCode: "US" });
  });
});

describe("parseInvitationalWorkbook — round robin format", () => {
  it("parses a round-robin format with grouped rounds", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "ROUND_ROBIN"]],
      Matchs: [
        MATCH_HEADER,
        ["Round 1", 1, "Alice", "", "FR", "Bob", "", "DE"],
        ["Round 1", 2, "Carol", "", "US", "Dave", "", "CA"],
        ["Round 2", 3, "Alice", "", "FR", "Carol", "", "US"],
      ],
    });

    const result = parseInvitationalWorkbook(buffer, "round-robin.xlsx");

    expect(result.format).toBe("ROUND_ROBIN");
    expect(result.matches.map((m) => m.groupLabel)).toEqual(["Round 1", "Round 1", "Round 2"]);
  });
});

describe("parseInvitationalWorkbook — no-bracket list format", () => {
  it("parses a flat list of matches with no grouping at all", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "LIST"]],
      Matchs: [
        ["Joueur A", "Tag A", "Pays A", "Joueur B", "Tag B", "Pays B"],
        ["Player1", "", "", "Player2", "", ""],
        ["Player3", "", "", "Player4", "", ""],
        ["Player5", "", "", "Player6", "", ""],
      ],
    });

    const result = parseInvitationalWorkbook(buffer, "showmatch.xlsx");

    expect(result.format).toBe("LIST");
    expect(result.matches).toHaveLength(3);
    expect(result.matches.every((m) => m.groupLabel === null)).toBe(true);
    // No "Ordre" column present: falls back to sequential row order.
    expect(result.matches.map((m) => m.orderIndex)).toEqual([1, 2, 3]);
  });

  it("ignores a Rundown sheet entirely, even if present", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "LIST"]],
      Rundown: [["Ceci ne doit jamais être lu"], ["Notes techniques régie"]],
      Matchs: [MATCH_HEADER, ["", 1, "Player1", "", "", "Player2", "", ""]],
    });

    const result = parseInvitationalWorkbook(buffer, "showmatch.xlsx");
    expect(result.matches).toHaveLength(1);
  });

  it("skips fully blank rows silently", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "LIST"]],
      Matchs: [
        MATCH_HEADER,
        ["", 1, "Player1", "", "", "Player2", "", ""],
        [],
        ["", 2, "Player3", "", "", "Player4", "", ""],
      ],
    });

    const result = parseInvitationalWorkbook(buffer, "showmatch.xlsx");
    expect(result.matches).toHaveLength(2);
  });
});

describe("parseInvitationalWorkbook — error handling", () => {
  it("rejects an unknown format value", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "TOTALLY_UNKNOWN"]],
      Matchs: [MATCH_HEADER, ["", 1, "A", "", "", "B", "", ""]],
    });
    expect(() => parseInvitationalWorkbook(buffer, "bad.xlsx")).toThrow(InvitationalImportError);
  });

  it("rejects a file missing the Info sheet", () => {
    const buffer = makeWorkbookBuffer({
      Matchs: [MATCH_HEADER, ["", 1, "A", "", "", "B", "", ""]],
    });
    expect(() => parseInvitationalWorkbook(buffer, "bad.xlsx")).toThrow(InvitationalImportError);
  });

  it("rejects a file missing the Matchs sheet", () => {
    const buffer = makeWorkbookBuffer({ Info: [["Format", "LIST"]] });
    expect(() => parseInvitationalWorkbook(buffer, "bad.xlsx")).toThrow(InvitationalImportError);
  });

  it("rejects a Matchs sheet missing the required player columns", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "LIST"]],
      Matchs: [["Groupe", "Ordre"], ["Round 1", 1]],
    });
    expect(() => parseInvitationalWorkbook(buffer, "bad.xlsx")).toThrow(InvitationalImportError);
  });
});

describe("parseInvitationalWorkbook — CSV", () => {
  it("parses a CSV with the Format/blank-line/table convention", () => {
    const csv =
      "Format,BRACKET_SINGLE\n\nGroupe,Ordre,Joueur A,Tag A,Pays A,Joueur B,Tag B,Pays B\n" +
      "Winners Final,1,SonicFox,Fly,US,Leffen,TSM,SE\n";
    const result = parseInvitationalWorkbook(Buffer.from(csv, "utf-8"), "event.csv");

    expect(result.format).toBe("BRACKET_SINGLE");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].competitorA?.name).toBe("SonicFox");
  });
});

describe("buildCompetitorRoster", () => {
  it("dedupes a competitor appearing across multiple matches by name (case/space-insensitive)", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "ROUND_ROBIN"]],
      Matchs: [
        MATCH_HEADER,
        ["Round 1", 1, "SonicFox", "Fly", "US", "Leffen", "TSM", "SE"],
        ["Round 2", 2, "  sonicfox  ", "Fly", "US", "Kayos", "", "US"],
      ],
    });
    const { matches } = parseInvitationalWorkbook(buffer, "event.xlsx");

    const roster = buildCompetitorRoster(matches);
    expect(roster.map((c) => c.name).sort()).toEqual(["Kayos", "Leffen", "SonicFox"].sort());
  });
});
