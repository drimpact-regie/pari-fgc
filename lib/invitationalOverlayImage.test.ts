import { describe, expect, it } from "vitest";

import {
  assertValidOverlayBackgroundDataUrl,
  InvitationalOverlayImageError,
  MAX_OVERLAY_BACKGROUND_BASE64_LENGTH,
} from "./invitationalOverlayImage";

describe("assertValidOverlayBackgroundDataUrl", () => {
  it("accepts an empty string (clears the custom background)", () => {
    expect(() => assertValidOverlayBackgroundDataUrl("")).not.toThrow();
  });

  it("accepts a well-formed PNG data URL within the size limit", () => {
    expect(() => assertValidOverlayBackgroundDataUrl("data:image/png;base64,aGVsbG8=")).not.toThrow();
  });

  it("rejects a non-PNG mime type", () => {
    expect(() => assertValidOverlayBackgroundDataUrl("data:image/jpeg;base64,aGVsbG8=")).toThrow(
      InvitationalOverlayImageError,
    );
  });

  it("rejects a plain URL that isn't a data: URL", () => {
    expect(() => assertValidOverlayBackgroundDataUrl("https://example.com/bg.png")).toThrow(
      InvitationalOverlayImageError,
    );
  });

  it("rejects an image over the size limit", () => {
    const oversized = "data:image/png;base64," + "a".repeat(MAX_OVERLAY_BACKGROUND_BASE64_LENGTH + 1);
    expect(() => assertValidOverlayBackgroundDataUrl(oversized)).toThrow(/volumineuse/);
  });
});
