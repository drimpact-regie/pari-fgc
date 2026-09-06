import { describe, expect, it } from "vitest";

import { importMatchesIntoInvitationalEvent } from "./invitationalEvents";
import type { ParsedInvitationalImport } from "./invitationalImport";

function makeParsed(format: ParsedInvitationalImport["format"]): ParsedInvitationalImport {
  return {
    format,
    matches: [
      {
        groupLabel: null,
        orderIndex: 1,
        competitorA: { name: "SonicFox", tag: null, countryCode: "US" },
        placeholderA: null,
        competitorB: { name: "Leffen", tag: null, countryCode: "SE" },
        placeholderB: null,
        ftGames: null,
        roundsPerGame: null,
        verifManette: null,
        startggSetId: null,
      },
    ],
  };
}

describe("importMatchesIntoInvitationalEvent", () => {
  it("rejects a file whose format doesn't match the event's confirmed format, before touching the database", async () => {
    // Le format est fixé à la confirmation de la demande (voir
    // lib/invitationalRequests.ts) — aucune route self-service ne doit
    // pouvoir le changer via un simple ré-import. La vérification doit
    // rejeter avant tout accès base (pas de mock prisma nécessaire ici :
    // un appel $transaction produirait une erreur réseau, pas cette
    // erreur-ci, si jamais la vérification était contournée).
    await expect(
      importMatchesIntoInvitationalEvent("event-a", "BRACKET_SINGLE", makeParsed("ROUND_ROBIN")),
    ).rejects.toThrow(/BRACKET_SINGLE/);
  });

  it("mentions both formats in the rejection message so the partner understands the mismatch", async () => {
    await expect(
      importMatchesIntoInvitationalEvent("event-a", "SWISS", makeParsed("POOLS")),
    ).rejects.toThrow(/SWISS/);
    await expect(
      importMatchesIntoInvitationalEvent("event-a", "SWISS", makeParsed("POOLS")),
    ).rejects.toThrow(/POOLS/);
  });
});
