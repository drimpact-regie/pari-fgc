import { describe, expect, it } from "vitest";

import {
  BRACKET_OVERLAY_ELEMENT_KEYS,
  DEFAULT_BRACKET_OVERLAY_LAYOUT,
  mergeBracketOverlayLayout,
} from "./invitationalBracketOverlayLayout";

describe("mergeBracketOverlayLayout", () => {
  it("returns the full default layout when nothing is stored", () => {
    expect(mergeBracketOverlayLayout(null)).toEqual(DEFAULT_BRACKET_OVERLAY_LAYOUT);
    expect(mergeBracketOverlayLayout(undefined)).toEqual(DEFAULT_BRACKET_OVERLAY_LAYOUT);
  });

  it("overrides only the elements present in a partial stored layout", () => {
    const merged = mergeBracketOverlayLayout({ standings: { x: 10, y: 20, size: 1.5 } });
    expect(merged.standings).toEqual({ x: 10, y: 20, size: 1.5 });
    expect(merged.matchList).toEqual(DEFAULT_BRACKET_OVERLAY_LAYOUT.matchList);
  });

  it("falls back to the default size for an invalid size without touching X/Y", () => {
    const merged = mergeBracketOverlayLayout({ standings: { x: 10, y: 20, size: "not-a-number" } });
    expect(merged.standings).toEqual({ x: 10, y: 20, size: DEFAULT_BRACKET_OVERLAY_LAYOUT.standings.size });
  });

  it("falls back to the default for a corrupted element without breaking the rest", () => {
    const merged = mergeBracketOverlayLayout({ standings: { x: 10, y: 20, size: 1 }, matchList: null });
    expect(merged.standings).toEqual({ x: 10, y: 20, size: 1 });
    expect(merged.matchList).toEqual(DEFAULT_BRACKET_OVERLAY_LAYOUT.matchList);
  });

  it("ignores unknown extra keys and still returns exactly the known element set", () => {
    const merged = mergeBracketOverlayLayout({ somethingElse: { x: 1, y: 2, size: 1 } });
    expect(Object.keys(merged).sort()).toEqual([...BRACKET_OVERLAY_ELEMENT_KEYS].sort());
  });
});
