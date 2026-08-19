// Service worker minimal pour Impact'O Bet.
//
// Son seul rôle est de satisfaire les critères d'installabilité PWA
// (Chrome/Android exige un service worker avec un handler `fetch`) et de
// fournir une page de secours hors-ligne. Il ne met JAMAIS en cache les
// pages authentifiées ni les réponses d'API (paris, comptes, résultats
// live) : toute requête part au réseau en priorité, sans interception —
// aucune donnée de pari n'est stockée dans le cache du navigateur.

const STATIC_CACHE = "impactobet-static-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Uniquement les requêtes de navigation (changement de page complète) :
  // réseau d'abord, et si ça échoue (pas de connexion), on affiche la
  // page de secours plutôt que l'écran d'erreur générique du navigateur.
  // Tout le reste (API, JS/CSS, images) passe directement au réseau sans
  // interception ni mise en cache.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
