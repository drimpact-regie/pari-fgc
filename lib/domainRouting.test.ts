import { describe, expect, it } from "vitest";

import {
  bridgeHref,
  classifyPath,
  crossDomainHref,
  domainOfHost,
  isDevOrPreviewHost,
} from "./domainRouting";

describe("classifyPath", () => {
  it("never classifies the homepage (served identically, never redirected)", () => {
    expect(classifyPath("/")).toBeNull();
  });

  it("classifies always-shared routes as null", () => {
    expect(classifyPath("/login")).toBeNull();
    expect(classifyPath("/register")).toBeNull();
    expect(classifyPath("/api/bets")).toBeNull();
    expect(classifyPath("/overlay/invitational/abc/match")).toBeNull();
  });

  it("classifies admin, streamer and partner routes as streamer", () => {
    expect(classifyPath("/admin/tournaments")).toBe("streamer");
    expect(classifyPath("/admin/ex")).toBe("streamer");
    expect(classifyPath("/streamer")).toBe("streamer");
    expect(classifyPath("/partner/invitational")).toBe("streamer");
  });

  it("classifies everything else as parieur", () => {
    expect(classifyPath("/leaderboard")).toBe("parieur");
    expect(classifyPath("/beaters")).toBe("parieur");
    expect(classifyPath("/account")).toBe("parieur");
    expect(classifyPath("/t/abc/matches")).toBe("parieur");
    expect(classifyPath("/invitational/request")).toBe("parieur");
  });
});

describe("isDevOrPreviewHost", () => {
  it("recognizes localhost and Vercel preview hosts", () => {
    expect(isDevOrPreviewHost("localhost:3000")).toBe(true);
    expect(isDevOrPreviewHost("127.0.0.1:3000")).toBe(true);
    expect(isDevOrPreviewHost("pari-fgc-git-feature.vercel.app")).toBe(true);
  });

  it("rejects real production hosts", () => {
    expect(isDevOrPreviewHost("www.impactobet.fr")).toBe(false);
    expect(isDevOrPreviewHost("www.impactobot.fr")).toBe(false);
  });
});

describe("domainOfHost", () => {
  it("maps both apex and www forms of each domain", () => {
    expect(domainOfHost("impactobet.fr")).toBe("parieur");
    expect(domainOfHost("www.impactobet.fr")).toBe("parieur");
    expect(domainOfHost("impactobot.fr")).toBe("streamer");
    expect(domainOfHost("www.impactobot.fr")).toBe("streamer");
  });

  it("returns null for unknown hosts", () => {
    expect(domainOfHost("localhost:3000")).toBeNull();
  });
});

describe("bridgeHref", () => {
  it("stays a plain relative link on the same domain", () => {
    expect(bridgeHref("/leaderboard", "www.impactobet.fr")).toBe("/leaderboard");
    expect(bridgeHref("/admin/tournaments", "www.impactobot.fr")).toBe("/admin/tournaments");
  });

  it("routes through the bridge when crossing domains", () => {
    const href = bridgeHref("/admin/tournaments", "www.impactobet.fr");
    expect(href).toBe("/api/auth/bridge/start?next=%2Fadmin%2Ftournaments&domain=streamer");
  });

  it("bypasses the bridge entirely on dev/preview hosts", () => {
    expect(bridgeHref("/admin/tournaments", "localhost:3000")).toBe("/admin/tournaments");
  });

  it("never bridges the homepage (classifyPath returns null for it)", () => {
    expect(bridgeHref("/", "www.impactobet.fr")).toBe("/");
  });
});

describe("crossDomainHref", () => {
  it("bridges an explicit target domain even for unclassified paths like /", () => {
    const href = crossDomainHref("/", "parieur", "www.impactobot.fr");
    expect(href).toBe("/api/auth/bridge/start?next=%2F&domain=parieur");
  });

  it("stays relative when already on the target domain", () => {
    expect(crossDomainHref("/", "streamer", "www.impactobot.fr")).toBe("/");
  });
});
