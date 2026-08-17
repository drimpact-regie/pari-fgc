import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));

const mockFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { invitationalEvent: { findUnique: (...args: unknown[]) => mockFindUnique(...args) } },
}));

import {
  generatePartnerAccessToken,
  partnerAccessCookieName,
  resolveInvitationalAccess,
} from "./invitationalAccess";

function makeEvent(overrides: Partial<{ ownerUserId: string | null; partnerAccessToken: string | null }> = {}) {
  return {
    id: "event-a",
    ownerUserId: null,
    partnerAccessToken: null,
    ...overrides,
  };
}

describe("resolveInvitationalAccess", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockFindUnique.mockReset();
  });

  it("returns null when the event doesn't exist", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockAuth.mockResolvedValue(null);
    expect(await resolveInvitationalAccess("missing", undefined)).toBeNull();
  });

  it("grants access to an admin session regardless of ownership", async () => {
    mockFindUnique.mockResolvedValue(makeEvent({ ownerUserId: "user-b" }));
    mockAuth.mockResolvedValue({ user: { id: "admin-1", isAdmin: true } });

    const result = await resolveInvitationalAccess("event-a", undefined);
    expect(result?.isAdmin).toBe(true);
    expect(result?.isOwner).toBe(false);
  });

  it("grants access to the session matching ownerUserId", async () => {
    mockFindUnique.mockResolvedValue(makeEvent({ ownerUserId: "user-a" }));
    mockAuth.mockResolvedValue({ user: { id: "user-a", isAdmin: false } });

    const result = await resolveInvitationalAccess("event-a", undefined);
    expect(result?.isOwner).toBe(true);
  });

  it("denies access to a different prestataire's session (isolation between partners)", async () => {
    mockFindUnique.mockResolvedValue(makeEvent({ ownerUserId: "user-a" }));
    mockAuth.mockResolvedValue({ user: { id: "user-b", isAdmin: false } });

    expect(await resolveInvitationalAccess("event-a", undefined)).toBeNull();
  });

  it("grants access via a matching cookie token (manual/email identification)", async () => {
    mockFindUnique.mockResolvedValue(makeEvent({ partnerAccessToken: "secret-token" }));
    mockAuth.mockResolvedValue(null);

    const result = await resolveInvitationalAccess("event-a", "secret-token");
    expect(result).not.toBeNull();
    expect(result?.isAdmin).toBe(false);
    expect(result?.isOwner).toBe(false);
  });

  it("denies access with a cookie token that doesn't match this event's token (isolation)", async () => {
    mockFindUnique.mockResolvedValue(makeEvent({ partnerAccessToken: "secret-token-a" }));
    mockAuth.mockResolvedValue(null);

    expect(await resolveInvitationalAccess("event-a", "secret-token-b")).toBeNull();
  });

  it("denies access with no session and no cookie", async () => {
    mockFindUnique.mockResolvedValue(makeEvent());
    mockAuth.mockResolvedValue(null);

    expect(await resolveInvitationalAccess("event-a", undefined)).toBeNull();
  });

  it("denies access to a logged-in non-owner even with an unrelated valid-looking cookie value", async () => {
    mockFindUnique.mockResolvedValue(makeEvent({ ownerUserId: "user-a", partnerAccessToken: null }));
    mockAuth.mockResolvedValue({ user: { id: "user-b", isAdmin: false } });

    expect(await resolveInvitationalAccess("event-a", "anything")).toBeNull();
  });
});

describe("partnerAccessCookieName", () => {
  it("is scoped per event id, so a cookie for one event never applies to another", () => {
    expect(partnerAccessCookieName("event-a")).not.toBe(partnerAccessCookieName("event-b"));
  });
});

describe("generatePartnerAccessToken", () => {
  it("generates distinct, non-trivial tokens", () => {
    const a = generatePartnerAccessToken();
    const b = generatePartnerAccessToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(16);
  });
});
