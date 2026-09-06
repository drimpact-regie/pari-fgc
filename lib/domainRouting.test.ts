import { describe, expect, it } from "vitest";

import {
  bridgeHref,
  classifyPath,
  crossDomainHref,
  domainOfHost,
  isDevOrPreviewHost,
  requestOrigin,
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
    // Un streamer connecté sur impactobot.fr doit pouvoir consulter son
    // solde/lier son compte Twitch sans jamais être renvoyé vers
    // impactobet.fr (voir Nav.tsx, qui affiche ce lien sur les deux
    // domaines) — /account reste donc sur le domaine d'où il est visité.
    expect(classifyPath("/account")).toBeNull();
  });

  it("classifies admin, streamer and partner routes as streamer", () => {
    expect(classifyPath("/admin")).toBe("streamer");
    expect(classifyPath("/admin/tournaments")).toBe("streamer");
    expect(classifyPath("/admin/ex")).toBe("streamer");
    expect(classifyPath("/streamer")).toBe("streamer");
    expect(classifyPath("/partner/invitational")).toBe("streamer");
  });

  it("locks the streamer-only Twitch OAuth entry points to the streamer domain despite the /api/ exemption", () => {
    // Ces deux flux sont liés à des pages qui n'existent QUE côté streamer
    // (/streamer, /admin/*) — les atteindre depuis le mauvais domaine
    // (favori, URL tapée à la main) produirait un redirect_uri jamais
    // enregistré côté Twitch ("The provided redirect_uri does not match").
    expect(classifyPath("/api/streamer/authorize/connect")).toBe("streamer");
    expect(classifyPath("/api/streamer/authorize/callback")).toBe("streamer");
    expect(classifyPath("/api/admin/twitch/connect")).toBe("streamer");
    expect(classifyPath("/api/admin/twitch/callback")).toBe("streamer");
  });

  it("leaves the account-linking flow and other /api/ routes (webhooks, shared NextAuth sign-in) unclassified", () => {
    // Contrairement au bot self-service/admin ci-dessus, la liaison de
    // compte Twitch part de /account — accessible sur les deux domaines
    // (voir ci-dessus) — donc reste elle aussi sur le domaine d'où on l'a
    // démarrée, pour que le cookie d'état anti-CSRF posé au départ soit
    // bien celui relu au retour de Twitch.
    expect(classifyPath("/api/twitch/link/connect")).toBeNull();
    expect(classifyPath("/api/twitch/link/callback")).toBeNull();
    expect(classifyPath("/api/bets")).toBeNull();
    expect(classifyPath("/api/auth/callback/twitch")).toBeNull();
    expect(classifyPath("/api/twitch/webhook")).toBeNull();
  });

  it("classifies everything else as parieur", () => {
    expect(classifyPath("/leaderboard")).toBe("parieur");
    expect(classifyPath("/beaters")).toBe("parieur");
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

describe("requestOrigin", () => {
  // Une route API qui construit son redirect_uri OAuth (ou toute URL
  // absolue auto-référentielle) à partir de `new URL(request.url).origin`
  // peut recevoir, sur Vercel avec plusieurs domaines custom sur un même
  // projet, l'adresse de déploiement plutôt que le domaine réellement
  // visité — d'où ce helper, qui lit directement les en-têtes de la
  // requête plutôt que le champ `.url` de l'objet Request (voir son
  // commentaire dans lib/domainRouting.ts).
  it("prefers X-Forwarded-Host (set by Vercel's proxy) over the Host header", () => {
    const request = new Request("https://deployment-internal.vercel.app/api/twitch/link/connect", {
      headers: { host: "deployment-internal.vercel.app", "x-forwarded-host": "www.impactobot.fr" },
    });
    expect(requestOrigin(request)).toBe("https://www.impactobot.fr");
  });

  it("falls back to the Host header when X-Forwarded-Host is absent", () => {
    const request = new Request("https://ignored.example/api/twitch/link/connect", {
      headers: { host: "www.impactobet.fr" },
    });
    expect(requestOrigin(request)).toBe("https://www.impactobet.fr");
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
