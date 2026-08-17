import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

const APEX_HOST = "impactobet.fr";
const CANONICAL_HOST = "www.impactobet.fr";

// Publiques quel que soit l'état de connexion : ni redirigées vers /login,
// ni redirigées vers "/" si déjà connecté (page.tsx gère lui-même la
// redirection des utilisateurs connectés qui visitent "/").
const PUBLIC_ALWAYS_PATHS = ["/", "/streamer", "/invitational/request"];
// Publiques seulement si déconnecté : redirigées vers "/" une fois connecté
// (pas besoin de revoir ces formulaires après authentification).
const PUBLIC_PATHS = ["/login", "/register"];

export const proxy = auth((req) => {
  // Les flux OAuth Twitch (bot, liaison de compte, connexion) exigent un
  // redirect_uri identique au caractère près à celui enregistré côté Twitch
  // (www.impactobet.fr) — ce redirect_uri est dérivé de l'origine de la
  // requête en cours, donc visiter le site via le domaine nu (sans "www")
  // produit un redirect_uri différent et fait échouer tout le flux avec
  // "The provided redirect_uri does not match". On force donc "www" ici,
  // avant même la logique d'authentification ci-dessous.
  //
  // req.nextUrl.hostname reflète l'adresse d'écoute du serveur, pas
  // forcément le domaine réellement visité par le navigateur (confirmé en
  // local : "localhost" même avec un en-tête Host différent) — on se base
  // donc directement sur l'en-tête Host (ou X-Forwarded-Host derrière un
  // proxy comme celui de Vercel), la seule source fiable du domaine visité.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  if (host === APEX_HOST) {
    const url = req.nextUrl.clone();
    url.protocol = "https";
    url.hostname = CANONICAL_HOST;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC_ALWAYS_PATHS.includes(pathname) ||
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/register") ||
    // Appelé directement par les serveurs Twitch (EventSub), pas par un
    // navigateur avec notre session — doit rester accessible sans login.
    // La sécurité de cette route est assurée par la vérification de
    // signature HMAC, pas par l'authentification applicative.
    pathname.startsWith("/api/twitch/webhook") ||
    // Flux self-service public d'autorisation du bot par un streamer
    // (scope channel:bot) — n'importe qui, sans compte sur ce site.
    pathname.startsWith("/api/streamer/authorize") ||
    // Appelé par Vercel Cron, sans session navigateur — sécurité assurée par
    // le secret CRON_SECRET vérifié dans la route elle-même.
    pathname.startsWith("/api/cron") ||
    // Endpoint public en lecture seule exposant l'état d'un event
    // Invitational/Prestataire, en anticipation d'un futur overlay stream
    // (OBS browser source) — ne renvoie que des données déjà destinées à
    // être affichées à l'écran, jamais de données de compte/pari.
    pathname.startsWith("/api/invitational/events/") ||
    // Pages overlay OBS (Browser Source) et leur API dédiée : chargées
    // directement par OBS, sans session navigateur — lecture seule, mêmes
    // données déjà publiques sur les pages event.
    pathname.startsWith("/overlay/") ||
    pathname.startsWith("/api/invitational/overlay/") ||
    // Portail self-service prestataire Invitational (voir
    // lib/invitationalAccess.ts) : soumission de demande publique, et accès
    // à SA page/API d'event pour un prestataire identifié manuellement (par
    // email, donc sans session NextAuth — seulement le cookie d'accès posé
    // par la route "claim"). Chaque route/page listée ci-dessous revérifie
    // elle-même l'accès (admin, propriétaire connecté, ou cookie valide
    // pour CET event) — ce bypass ne fait que laisser la requête atteindre
    // ce contrôle, il ne l'affaiblit pas.
    pathname.startsWith("/api/invitational/requests") ||
    pathname.startsWith("/partner/invitational/") ||
    pathname.startsWith("/api/partner/invitational/") ||
    pathname.startsWith("/api/admin/invitational/events/") ||
    pathname.startsWith("/api/admin/invitational/matches/");

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
