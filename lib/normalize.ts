/**
 * Accepte soit un slug brut ("tournament/x/event/y"), soit une URL complète
 * start.gg collée telle quelle — erreur d'usage courante à absorber plutôt
 * qu'à rejeter.
 */
export function normalizeEventSlug(input: string): string {
  const trimmed = input.trim();
  const marker = "start.gg/";
  const idx = trimmed.indexOf(marker);
  const withoutDomain = idx === -1 ? trimmed : trimmed.slice(idx + marker.length);
  const slug = withoutDomain.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "");
  // Lien vers une sous-page d'un jeu (".../event/sf6/overview") : on ne garde que le jeu.
  const eventMatch = slug.match(/^tournament\/[^/]+\/event\/[^/]+/);
  return eventMatch ? eventMatch[0] : slug;
}

/** Vrai si le slug désigne un jeu précis ("tournament/x/event/y"), pas le tournoi entier. */
export function isEventSlug(slug: string): boolean {
  return /^tournament\/[^/]+\/event\/[^/]+$/.test(slug);
}

/**
 * Comme normalizeEventSlug, mais pour le TOURNOI entier (racine
 * "tournament/xxx"), utilisé pour l'import groupé de tous ses jeux (voir
 * getTournamentEvents dans lib/startgg.ts) — accepte n'importe quelle page
 * du tournoi collée telle quelle (page "details", un event précis, etc.) et
 * ne garde que le segment "tournament/xxx".
 */
export function normalizeTournamentSlug(input: string): string {
  const eventSlug = normalizeEventSlug(input);
  const match = eventSlug.match(/^tournament\/[^/]+/);
  return match ? match[0] : eventSlug;
}

/**
 * Accepte soit un nom de chaîne brut ("mk_rza"), soit une URL Twitch
 * complète collée telle quelle.
 */
export function normalizeTwitchChannel(input: string): string {
  const trimmed = input.trim();
  const marker = "twitch.tv/";
  const idx = trimmed.indexOf(marker);
  const withoutDomain = idx === -1 ? trimmed : trimmed.slice(idx + marker.length);
  return withoutDomain.replace(/^\/+|\/+$/g, "").split(/[/?]/)[0];
}
