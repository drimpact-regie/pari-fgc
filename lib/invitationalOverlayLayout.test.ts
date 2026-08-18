import { describe, expect, it } from "vitest";

import {
  DEFAULT_OVERLAY_LAYOUT,
  mergeOverlayLayout,
  OVERLAY_ELEMENT_KEYS,
} from "./invitationalOverlayLayout";

describe("mergeOverlayLayout", () => {
  it("returns the full default layout when nothing is stored", () => {
    expect(mergeOverlayLayout(null)).toEqual(DEFAULT_OVERLAY_LAYOUT);
    expect(mergeOverlayLayout(undefined)).toEqual(DEFAULT_OVERLAY_LAYOUT);
  });

  it("overrides only the elements present in a partial stored layout", () => {
    const merged = mergeOverlayLayout({ nameA: { x: 10, y: 20, size: 3 } });
    expect(merged.nameA).toEqual({ x: 10, y: 20, size: 3 });
    for (const key of OVERLAY_ELEMENT_KEYS) {
      if (key === "nameA") continue;
      expect(merged[key]).toEqual(DEFAULT_OVERLAY_LAYOUT[key]);
    }
  });

  it("falls back to the default for a single corrupted element without breaking the rest", () => {
    const merged = mergeOverlayLayout({
      nameA: { x: 10, y: 20, size: 3 },
      scoreA: { x: "not-a-number", y: 20, size: 3 },
      tagA: null,
    });
    expect(merged.nameA).toEqual({ x: 10, y: 20, size: 3 });
    expect(merged.scoreA).toEqual({ ...DEFAULT_OVERLAY_LAYOUT.scoreA, size: 3 });
    expect(merged.tagA).toEqual(DEFAULT_OVERLAY_LAYOUT.tagA);
  });

  it("ignores unknown extra keys and still returns exactly the known element set", () => {
    const merged = mergeOverlayLayout({ somethingElse: { x: 1, y: 2, size: 1 } });
    expect(Object.keys(merged).sort()).toEqual([...OVERLAY_ELEMENT_KEYS].sort());
  });

  it("two events with different stored layouts never affect each other's merge result", () => {
    const eventA = mergeOverlayLayout({ nameA: { x: 1, y: 1, size: 1 } });
    const eventB = mergeOverlayLayout({ nameA: { x: 999, y: 999, size: 5 } });
    expect(eventA.nameA).toEqual({ x: 1, y: 1, size: 1 });
    expect(eventB.nameA).toEqual({ x: 999, y: 999, size: 5 });
  });

  it("keeps X/Y from a layout stored before the size field existed, and fills in the default size", () => {
    const merged = mergeOverlayLayout({ nameA: { x: 10, y: 20 } });
    expect(merged.nameA).toEqual({ x: 10, y: 20, size: DEFAULT_OVERLAY_LAYOUT.nameA.size });
  });

  it("falls back to the default size for an invalid size without touching X/Y", () => {
    const merged = mergeOverlayLayout({ nameA: { x: 10, y: 20, size: "not-a-number" } });
    expect(merged.nameA).toEqual({ x: 10, y: 20, size: DEFAULT_OVERLAY_LAYOUT.nameA.size });

    const mergedZero = mergeOverlayLayout({ nameA: { x: 10, y: 20, size: 0 } });
    expect(mergedZero.nameA).toEqual({ x: 10, y: 20, size: DEFAULT_OVERLAY_LAYOUT.nameA.size });
  });
});
