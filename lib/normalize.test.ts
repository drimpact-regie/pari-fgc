import { describe, expect, it } from "vitest";

import { normalizeEventSlug, normalizeTournamentSlug, normalizeTwitchChannel } from "./normalize";

describe("normalizeEventSlug", () => {
  it("strips the domain from a full URL", () => {
    expect(normalizeEventSlug("https://www.start.gg/tournament/xxx/event/yyy")).toBe(
      "tournament/xxx/event/yyy",
    );
  });

  it("leaves a raw slug unchanged", () => {
    expect(normalizeEventSlug("tournament/xxx/event/yyy")).toBe("tournament/xxx/event/yyy");
  });

  it("trims surrounding slashes and whitespace", () => {
    expect(normalizeEventSlug("  /tournament/xxx/event/yyy/  ")).toBe("tournament/xxx/event/yyy");
  });
});

describe("normalizeTournamentSlug", () => {
  it("keeps only the tournament root from a full event URL", () => {
    expect(
      normalizeTournamentSlug("https://www.start.gg/tournament/ultimate-fighting-arena-2026-2/event/marvel"),
    ).toBe("tournament/ultimate-fighting-arena-2026-2");
  });

  it("strips a trailing page like /details", () => {
    expect(
      normalizeTournamentSlug("https://www.start.gg/tournament/ultimate-fighting-arena-2026-2/details"),
    ).toBe("tournament/ultimate-fighting-arena-2026-2");
  });

  it("leaves a bare tournament slug unchanged", () => {
    expect(normalizeTournamentSlug("tournament/ultimate-fighting-arena-2026-2")).toBe(
      "tournament/ultimate-fighting-arena-2026-2",
    );
  });
});

describe("normalizeTwitchChannel", () => {
  it("strips the domain and any trailing path from a full Twitch URL", () => {
    expect(normalizeTwitchChannel("https://www.twitch.tv/mk_rza/schedule")).toBe("mk_rza");
  });

  it("leaves a raw channel name unchanged", () => {
    expect(normalizeTwitchChannel("mk_rza")).toBe("mk_rza");
  });
});
