import { describe, expect, it } from "vitest";

import {
  isHelpCommand,
  isMvcCommand,
  isResetCommand,
  isTop8Command,
  matchCharacterName,
  normalizeForMatch,
  parseMvcCommand,
  parseResetCommand,
  parseTop8Target,
} from "./chatBets";

const ROSTER = [
  { id: "1", name: "Ms. Marvel" },
  { id: "2", name: "Magik" },
  { id: "3", name: "Magneto" },
  { id: "4", name: "Iron Man" },
  { id: "5", name: "Star-Lord" },
  { id: "6", name: "Spider-Man" },
];

describe("normalizeForMatch", () => {
  it("lowercases, strips accents, and strips all punctuation/whitespace", () => {
    expect(normalizeForMatch("  Étoile-Lord  ")).toBe("etoilelord");
    expect(normalizeForMatch("Ms.   Marvel")).toBe("msmarvel");
  });
});

describe("matchCharacterName", () => {
  it("matches exactly regardless of case", () => {
    expect(matchCharacterName("magik", ROSTER).match?.name).toBe("Magik");
    expect(matchCharacterName("MAGIK", ROSTER).match?.name).toBe("Magik");
  });

  it("matches a unique prefix", () => {
    expect(matchCharacterName("iron", ROSTER).match?.name).toBe("Iron Man");
  });

  it("matches a hyphenated name typed without punctuation/spaces", () => {
    expect(matchCharacterName("spiderman", ROSTER).match?.name).toBe("Spider-Man");
    expect(matchCharacterName("spider man", ROSTER).match?.name).toBe("Spider-Man");
    expect(matchCharacterName("starlord", ROSTER).match?.name).toBe("Star-Lord");
  });

  it("suggests all candidates on an ambiguous prefix instead of guessing", () => {
    const result = matchCharacterName("mag", ROSTER);
    expect(result.match).toBeNull();
    expect(result.suggestions.sort()).toEqual(["Magik", "Magneto"]);
  });

  it("suggests (but does not auto-bet on) a name close to a typo", () => {
    // A typo never silently resolves to a bet — only an exact or
    // unambiguous match does. A close-but-imperfect name comes back as a
    // suggestion so the chatter can retry with the exact spelling.
    const result = matchCharacterName("maagik", ROSTER);
    expect(result.match).toBeNull();
    expect(result.suggestions).toContain("Magik");
  });

  it("returns no suggestions for a completely unrelated query", () => {
    const result = matchCharacterName("zzz", ROSTER);
    expect(result.match).toBeNull();
    expect(result.suggestions).toEqual([]);
  });

  it("returns no match for an empty query", () => {
    expect(matchCharacterName("   ", ROSTER).match).toBeNull();
  });
});

describe("isMvcCommand / isResetCommand", () => {
  it("recognizes the mvc sub-command regardless of case", () => {
    expect(isMvcCommand("mvc Magik 3")).toBe(true);
    expect(isMvcCommand("MVC Magik 3")).toBe(true);
    expect(isMvcCommand("reset oui")).toBe(false);
  });

  it("recognizes the reset sub-command regardless of case", () => {
    expect(isResetCommand("reset oui")).toBe(true);
    expect(isResetCommand("RESET non")).toBe(true);
    expect(isResetCommand("mvc Magik 3")).toBe(false);
  });

  it("does not mistake a player name for a sub-command", () => {
    expect(isMvcCommand("Mulchy")).toBe(false);
    expect(isResetCommand("Reseter")).toBe(false);
  });
});

describe("isTop8Command / parseTop8Target", () => {
  it("recognizes '!bet top8' and '!bet top 8' regardless of case", () => {
    expect(isTop8Command("top8 A, B, C")).toBe(true);
    expect(isTop8Command("Top 8 A, B, C")).toBe(true);
    expect(isTop8Command("TOP8")).toBe(true);
    expect(isTop8Command("mvc Magik 3")).toBe(false);
  });

  it("does not mistake a player name for the top8 sub-command", () => {
    expect(isTop8Command("Toplevel")).toBe(false);
  });

  it("extracts the names after the top8/top 8 prefix", () => {
    expect(parseTop8Target("top8 A, B, C")).toBe("A, B, C");
    expect(parseTop8Target("top 8 A, B, C")).toBe("A, B, C");
  });

  it("returns null when the target has no top8/top 8 prefix", () => {
    expect(parseTop8Target("mvc Magik 3")).toBeNull();
  });
});

describe("isHelpCommand", () => {
  it("recognizes an empty target and 'aide'/'help' regardless of case", () => {
    expect(isHelpCommand("")).toBe(true);
    expect(isHelpCommand("   ")).toBe(true);
    expect(isHelpCommand("aide")).toBe(true);
    expect(isHelpCommand("AIDE")).toBe(true);
    expect(isHelpCommand("help")).toBe(true);
  });

  it("does not mistake a real sub-command or player name for the help command", () => {
    expect(isHelpCommand("mvc Magik 3")).toBe(false);
    expect(isHelpCommand("Mulchy")).toBe(false);
  });
});

describe("parseMvcCommand", () => {
  it("parses a valid command with a multi-word character name", () => {
    expect(parseMvcCommand("mvc Ms. Marvel 3")).toEqual({
      characterQuery: "Ms. Marvel",
      count: 3,
    });
  });

  it("rejects a count outside 0-8", () => {
    expect(parseMvcCommand("mvc Magik 9")).toBeNull();
    expect(parseMvcCommand("mvc Magik -1")).toBeNull();
  });

  it("rejects a missing count", () => {
    expect(parseMvcCommand("mvc Magik")).toBeNull();
  });

  it("accepts the boundary values 0 and 8", () => {
    expect(parseMvcCommand("mvc Magik 0")).toEqual({ characterQuery: "Magik", count: 0 });
    expect(parseMvcCommand("mvc Magik 8")).toEqual({ characterQuery: "Magik", count: 8 });
  });
});

describe("parseResetCommand", () => {
  it("accepts French and English yes/no aliases", () => {
    expect(parseResetCommand("reset oui")).toBe(true);
    expect(parseResetCommand("reset yes")).toBe(true);
    expect(parseResetCommand("reset non")).toBe(false);
    expect(parseResetCommand("reset no")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(parseResetCommand("reset OUI")).toBe(true);
  });

  it("returns null on an unrecognized word (syntax error)", () => {
    expect(parseResetCommand("reset maybe")).toBeNull();
  });

  it("returns null on a missing argument", () => {
    expect(parseResetCommand("reset")).toBeNull();
  });
});
