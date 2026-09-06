import { describe, expect, it } from "vitest";

import { cqwToPx } from "./useContainerWidthPx";

describe("cqwToPx", () => {
  it("converts a cqw-style size (1 = 1% of container width) to a px string once the width is known", () => {
    expect(cqwToPx(1.7, 1000)).toBe("17px");
    expect(cqwToPx(0.8, 1000)).toBe("8px");
  });

  it("keeps the relative ordering between two sizes for the same measured width", () => {
    const namePx = parseFloat(cqwToPx(1.7, 1920));
    const tagPx = parseFloat(cqwToPx(0.8, 1920));
    expect(tagPx).toBeLessThan(namePx);
  });

  it("falls back to the cqw unit while the container width hasn't been measured yet", () => {
    expect(cqwToPx(1.7, null)).toBe("1.7cqw");
  });
});
