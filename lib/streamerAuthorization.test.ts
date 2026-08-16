import { describe, expect, it } from "vitest";

import { computeChannelAuthorizationStatus } from "./streamerAuthorization";

describe("computeChannelAuthorizationStatus", () => {
  it("is 'current' when the grant matches the active bot account", () => {
    expect(computeChannelAuthorizationStatus({ botLoginAtGrant: "ImpactOBot" }, "ImpactOBot")).toBe(
      "current",
    );
  });

  it("is 'outdated' when the grant was made under a different bot account", () => {
    expect(computeChannelAuthorizationStatus({ botLoginAtGrant: "DrImpact" }, "ImpactOBot")).toBe(
      "outdated",
    );
  });

  it("is 'unknown' when there is no authorization record at all", () => {
    expect(computeChannelAuthorizationStatus(null, "ImpactOBot")).toBe("unknown");
  });

  it("is 'unknown' when no bot account is currently connected", () => {
    expect(computeChannelAuthorizationStatus({ botLoginAtGrant: "DrImpact" }, null)).toBe("unknown");
  });
});
