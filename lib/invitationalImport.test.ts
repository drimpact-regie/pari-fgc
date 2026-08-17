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
      placeholderA: null,
      competitorB: { name: "Leffen", tag: "TSM", countryCode: "SE" },
      placeholderB: null,
      ftGames: null,
      roundsPerGame: null,
      verifManette: null,
    });
    // Empty tag/country cells become null, not empty strings.
    expect(result.matches[1].competitorA).toEqual({ name: "Kayos", tag: null, countryCode: "US" });
  });
});

describe("parseInvitationalWorkbook — TBD_ placeholders", () => {
  it("recognizes a TBD_ cell as a not-yet-determined competitor, not a real player", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "BRACKET_SINGLE"]],
      Matchs: [
        MATCH_HEADER,
        ["Demi-finale", 1, "TBD_Vainqueur QF1", "", "", "TBD_Vainqueur QF2", "", ""],
      ],
    });

    const result = parseInvitationalWorkbook(buffer, "bracket.xlsx");

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].competitorA).toBeNull();
    expect(result.matches[0].placeholderA).toBe("Vainqueur QF1");
    expect(result.matches[0].competitorB).toBeNull();
    expect(result.matches[0].placeholderB).toBe("Vainqueur QF2");
  });

  it("is case-insensitive on the TBD_ prefix", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "LIST"]],
      Matchs: [MATCH_HEADER, ["", 1, "tbd_Table 1", "", "", "Real Player", "", ""]],
    });

    const result = parseInvitationalWorkbook(buffer, "event.xlsx");

    expect(result.matches[0].competitorA).toBeNull();
    expect(result.matches[0].placeholderA).toBe("Table 1");
    expect(result.matches[0].competitorB).toEqual({ name: "Real Player", tag: null, countryCode: null });
  });

  it("falls back to a generic description for a bare TBD_ with nothing after it", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "LIST"]],
      Matchs: [MATCH_HEADER, ["", 1, "TBD_", "", "", "Real Player", "", ""]],
    });

    const result = parseInvitationalWorkbook(buffer, "event.xlsx");
    expect(result.matches[0].placeholderA).toBe("À déterminer");
  });

  it("does not treat a row with only TBD_ placeholders as a blank row to skip", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "BRACKET_SINGLE"]],
      Matchs: [
        MATCH_HEADER,
        ["Quart", 1, "Alice", "", "FR", "Bob", "", "US"],
        ["Demi", 2, "TBD_Vainqueur QF1", "", "", "TBD_Vainqueur QF2", "", ""],
      ],
    });

    const result = parseInvitationalWorkbook(buffer, "bracket.xlsx");
    expect(result.matches).toHaveLength(2);
  });

  it("excludes TBD_ placeholders from the competitor roster (no fake player created)", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "BRACKET_SINGLE"]],
      Matchs: [
        MATCH_HEADER,
        ["Quart", 1, "Alice", "", "FR", "Bob", "", "US"],
        ["Demi", 2, "TBD_Vainqueur QF1", "", "", "TBD_Vainqueur QF2", "", ""],
      ],
    });

    const { matches } = parseInvitationalWorkbook(buffer, "bracket.xlsx");
    const roster = buildCompetitorRoster(matches);
    expect(roster.map((c) => c.name).sort()).toEqual(["Alice", "Bob"]);
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

describe("parseInvitationalWorkbook — set structure (Format FT / Rounds par manche / Verif manette)", () => {
  const HEADER_WITH_STRUCTURE = [
    ...MATCH_HEADER,
    "Format (FT)",
    "Rounds par manche",
    "Verif manette",
  ];

  it("parses FT/rounds/verif columns when present", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "LIST"]],
      Matchs: [
        HEADER_WITH_STRUCTURE,
        ["", 1, "SonicFox", "", "US", "Leffen", "", "SE", "FT3", 2, "Oui"],
        ["", 2, "Kayozz", "", "FR", "Punk", "", "US", "FT5", 3, "Non"],
      ],
    });

    const result = parseInvitationalWorkbook(buffer, "event.xlsx");

    expect(result.matches[0]).toMatchObject({ ftGames: 3, roundsPerGame: 2, verifManette: true });
    expect(result.matches[1]).toMatchObject({ ftGames: 5, roundsPerGame: 3, verifManette: false });
  });

  it("is case-insensitive on Oui/Non and tolerant of the FT prefix casing", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "LIST"]],
      Matchs: [HEADER_WITH_STRUCTURE, ["", 1, "A", "", "", "B", "", "", "ft7", 2, "oui"]],
    });
    const result = parseInvitationalWorkbook(buffer, "event.xlsx");
    expect(result.matches[0]).toMatchObject({ ftGames: 7, roundsPerGame: 2, verifManette: true });
  });

  it("leaves ftGames/roundsPerGame/verifManette null when the columns are absent or blank", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "LIST"]],
      Matchs: [MATCH_HEADER, ["", 1, "A", "", "", "B", "", ""]],
    });
    const result = parseInvitationalWorkbook(buffer, "event.xlsx");
    expect(result.matches[0]).toMatchObject({ ftGames: null, roundsPerGame: null, verifManette: null });
  });
});

describe("parseInvitationalWorkbook — legend row above the header", () => {
  it("finds the real header row even when a legend/instructions row sits above it", () => {
    const buffer = makeWorkbookBuffer({
      Info: [["Format", "LIST"]],
      Matchs: [
        ["Rappel : préfixe TBD_ pour un compétiteur pas encore connu. Tag/Pays optionnels."],
        MATCH_HEADER,
        ["", 1, "Player1", "", "", "Player2", "", ""],
      ],
    });

    const result = parseInvitationalWorkbook(buffer, "with-legend.xlsx");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].competitorA?.name).toBe("Player1");
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
