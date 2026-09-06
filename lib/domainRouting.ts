/**
 * Séparation du site en deux domaines :
 * - impactobet.fr (et son alias www) : parieur, grand public.
 * - impactobot.fr (et son alias www) : streamer / prestataire / régie.
 *
 * Une seule app, une seule base — seul le ROUTAGE des pages change selon le
 * domaine visité (voir proxy.ts). Les routes /api/* et /overlay/* ne suivent
 * PAS cette classification : elles restent joignables depuis n'importe quel
 * domaine (voir isAlways ci-dessous), car appelées par des systèmes externes
 * (Twitch, OBS) qui ne connaissent qu'une seule URL déjà configurée en
 * production — leur faire suivre la classification casserait un overlay ou
 * un webhook déjà en place sur un tournoi en cours.
 */

export type SiteDomain = "parieur" | "streamer";

export const PARIEUR_APEX_HOST = "impactobet.fr";
export const PARIEUR_CANONICAL_HOST = "www.impactobet.fr";
export const STREAMER_APEX_HOST = "impactobot.fr";
export const STREAMER_CANONICAL_HOST = "www.impactobot.fr";

// Préfixes toujours servis identiquement sur les deux domaines, jamais
// redirigés par la classification de domaine (mais peuvent tout de même
// subir la canonicalisation apex → www, elle, indépendante du domaine).
// "/account" en fait partie : un streamer connecté sur impactobot.fr doit
// pouvoir consulter son solde/lier son compte Twitch SANS jamais quitter
// impactobot.fr (voir Nav.tsx, qui affiche le solde Ex et le lien "mon
// compte" sur les deux domaines) — un aller-retour vers impactobet.fr ici a
// cassé la vérification anti-CSRF du lien Twitch (cookie d'état posé sur un
// domaine, callback reçu sur un autre) en plus d'être une expérience
// perturbante pour un streamer qui n'a jamais quitté "son" interface.
const ALWAYS_PREFIXES = ["/api/", "/overlay/", "/login", "/register"];
const ALWAYS_EXACT = ["/api", "/login", "/register", "/account"];

// Sous-ensemble de /api/ verrouillé à UN SEUL domaine malgré ALWAYS_PREFIXES
// ci-dessus : contrairement à /api/twitch/link/* (compte perso, voir
// ALWAYS_EXACT ci-dessus — reste sur le domaine d'où on l'a démarré), ces
// deux flux sont liés à des pages qui n'existent QUE côté streamer
// (/streamer, /admin/*) — les verrouiller évite qu'un favori ou une URL
// tapée à la main sur impactobet.fr ne parte avec un redirect_uri jamais
// enregistré côté Twitch Developer Console ("The provided redirect_uri does
// not match").
const STREAMER_ONLY_PREFIXES = [
  "/api/streamer/authorize/", // lien depuis /streamer (streamer)
  "/api/admin/twitch/", // lien depuis /admin/tournaments (streamer)
];

// Routes "streamer" — cf. Partie 1 du prompt : self-service Twitch bot,
// portail Invitational (admin + partenaire), tout /admin/*, tout /overlay/*
// (déjà couvert par ALWAYS_PREFIXES ci-dessus, cité ici pour mémoire).
const STREAMER_PREFIXES = ["/admin/", "/streamer", "/partner/"];
const STREAMER_EXACT = ["/streamer", "/admin"];

/**
 * Classe un chemin (pathname, sans domaine) en "parieur", "streamer", ou
 * `null` si la route doit être servie identiquement quel que soit le domaine
 * (page "/" incluse : son rendu diffère par domaine, mais jamais via une
 * redirection — voir app/(site)/page.tsx).
 */
export function classifyPath(pathname: string): SiteDomain | null {
  if (pathname === "/") return null;

  if (STREAMER_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return "streamer";

  if (ALWAYS_EXACT.includes(pathname)) return null;
  if (ALWAYS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  if (STREAMER_EXACT.includes(pathname)) return "streamer";
  if (STREAMER_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return "streamer";

  return "parieur";
}

/**
 * Bypass dev/preview : localhost et les URLs de preview Vercel ne suivent
 * aucune règle de domaine (tout reste accessible depuis une seule adresse,
 * comme aujourd'hui) — indispensable puisque ces environnements n'ont
 * qu'un seul hostname, pas deux domaines distincts.
 */
export function isDevOrPreviewHost(host: string): boolean {
  const bareHost = host.split(":")[0];
  return (
    bareHost === "localhost" ||
    bareHost === "127.0.0.1" ||
    bareHost.endsWith(".vercel.app")
  );
}

export function domainOfHost(host: string): SiteDomain | null {
  const bareHost = host.split(":")[0].toLowerCase();
  if (bareHost === PARIEUR_APEX_HOST || bareHost === PARIEUR_CANONICAL_HOST) return "parieur";
  if (bareHost === STREAMER_APEX_HOST || bareHost === STREAMER_CANONICAL_HOST) return "streamer";
  return null;
}

export function canonicalHostFor(domain: SiteDomain): string {
  return domain === "parieur" ? PARIEUR_CANONICAL_HOST : STREAMER_CANONICAL_HOST;
}

/**
 * Origine (protocole + host) fiable de la requête en cours, à utiliser pour
 * construire tout redirect_uri OAuth Twitch ou toute URL absolue
 * auto-référentielle depuis une route API. `new URL(request.url).origin`
 * (l'approche naïve, encore utilisée par endroits) peut refléter, dans une
 * route handler Vercel avec plusieurs domaines custom sur un même projet,
 * l'adresse de déploiement plutôt que le domaine RÉELLEMENT visité par le
 * navigateur — exactement le même piège documenté pour req.nextUrl.hostname
 * en middleware (voir proxy.ts, qui a dû s'en écarter pour la même raison).
 * Seul l'en-tête Host (ou X-Forwarded-Host derrière le proxy de Vercel)
 * reflète fidèlement le domaine visité — c'est ce qui a fait échouer la
 * liaison de compte Twitch depuis impactobot.fr malgré un routage déjà
 * correct : le domaine était bon, mais le redirect_uri envoyé à Twitch ne
 * l'était pas.
 */
export function requestOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return `https://${host}`;
}

/**
 * Construit l'URL vers `path`, en passant par le pont SSO
 * (/api/auth/bridge/start) si `targetDomain` diffère du domaine de
 * `currentHost` — pour que tous les liens internes potentiellement
 * inter-domaines (menu, redirections post-action) restent utilisables sans
 * "reconnexion" visible. Reste un simple lien relatif si la cible est déjà
 * sur le domaine de la requête en cours (cas le plus fréquent, aucun
 * aller-retour serveur superflu).
 *
 * `targetDomain` est explicite (plutôt que déduit de `path` seul) car "/"
 * n'a pas de classification propre — son rendu diffère par domaine sans
 * jamais être redirigé (voir classifyPath) — donc un lien qui doit
 * délibérément traverser vers la racine de l'AUTRE domaine (ex. "Voir le
 * site parieur" depuis l'accueil streamer) doit le préciser lui-même.
 */
export function crossDomainHref(path: string, targetDomain: SiteDomain, currentHost: string): string {
  if (isDevOrPreviewHost(currentHost)) return path;

  const currentDomain = domainOfHost(currentHost);
  if (currentDomain === null || currentDomain === targetDomain) return path;

  const bridgeUrl = new URL("/api/auth/bridge/start", "https://placeholder.invalid");
  bridgeUrl.searchParams.set("next", path);
  bridgeUrl.searchParams.set("domain", targetDomain);
  return bridgeUrl.pathname + bridgeUrl.search;
}

/**
 * Variante de crossDomainHref() pour les chemins classifiables (tout sauf
 * "/") : déduit le domaine cible directement de `path` via classifyPath().
 */
export function bridgeHref(path: string, currentHost: string): string {
  const targetDomain = classifyPath(path);
  if (targetDomain === null) return path;
  return crossDomainHref(path, targetDomain, currentHost);
}
