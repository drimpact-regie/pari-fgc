import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildPartnerAccessEmail, isEmailConfigured, sendEmail } from "./email";

describe("buildPartnerAccessEmail", () => {
  it("includes the access link in both the text and html bodies", () => {
    const message = buildPartnerAccessEmail({
      to: "prestataire@example.com",
      eventName: "Showmatch RZA vs Sonicfox",
      accessUrl: "https://impactobet.fr/api/partner/invitational/events/evt1/claim?token=abc123",
    });

    expect(message.to).toBe("prestataire@example.com");
    expect(message.subject).toContain("Showmatch RZA vs Sonicfox");
    expect(message.text).toContain("https://impactobet.fr/api/partner/invitational/events/evt1/claim?token=abc123");
    expect(message.html).toContain("https://impactobet.fr/api/partner/invitational/events/evt1/claim?token=abc123");
  });

  it("escapes HTML-significant characters from the event name in the html body", () => {
    const message = buildPartnerAccessEmail({
      to: "a@b.com",
      eventName: '<script>alert("x")</script>',
      accessUrl: "https://impactobet.fr/x",
    });

    expect(message.html).not.toContain("<script>");
  });
});

describe("isEmailConfigured / sendEmail", () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.EMAIL_FROM;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
    process.env.EMAIL_FROM = originalFrom;
    globalThis.fetch = originalFetch;
  });

  it("is not configured and is a no-op when env vars are missing", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    expect(isEmailConfigured()).toBe(false);
    await sendEmail({ to: "a@b.com", subject: "s", html: "<p>h</p>", text: "t" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the access link to the Resend API when configured", async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.EMAIL_FROM = "bot@impactobet.fr";

    let capturedBody: string | undefined;
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    expect(isEmailConfigured()).toBe(true);

    const message = buildPartnerAccessEmail({
      to: "prestataire@example.com",
      eventName: "Showmatch",
      accessUrl: "https://impactobet.fr/api/partner/invitational/events/evt1/claim?token=abc123",
    });
    await sendEmail(message);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://api.resend.com/emails");
    const parsed = JSON.parse(capturedBody!);
    expect(parsed.to).toBe("prestataire@example.com");
    expect(parsed.html).toContain("token=abc123");
  });
});
