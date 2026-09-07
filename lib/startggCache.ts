/**
 * Séparé de lib/startgg.ts délibérément : "next/cache" (revalidateTag) est
 * une API server-only, alors que lib/startgg.ts est aussi importé par des
 * Client Components (ex. components/Top8Bracket.tsx, pour SET_STATE/
 * StartggSet) — y importer "next/cache" faisait échouer le build webpack
 * ("You're importing a module that depends on revalidateTag... in the Pages
 * Router", même si l'usage réel se fait bien côté App Router/serveur, le
 * bundler suit le graphe d'import complet du module côté client).
 */
import { revalidateTag } from "next/cache";

/**
 * Force le prochain appel start.gg pour CE tournoi à aller chercher des
 * données fraîches, sans attendre la fin de la fenêtre STARTGG_CACHE_SECONDS
 * — pour un bouton "Rafraîchir depuis start.gg" côté admin (voir
 * app/api/admin/tournaments/[tournamentId]/refresh/route.ts). `{ expire: 0 }`
 * (plutôt que le profil "max" par défaut, recommandé pour la plupart des cas)
 * expire IMMÉDIATEMENT le tag : un clic doit se traduire par une vraie
 * donnée à jour au prochain chargement, pas par un service de données
 * encore périmées le temps qu'un rafraîchissement se fasse en arrière-plan.
 * Le tag lui-même (`startgg:<eventSlug>`) est posé côté lib/startgg.ts,
 * voir startggCacheTag.
 */
export function invalidateStartggCache(eventSlug: string): void {
  revalidateTag(`startgg:${eventSlug}`, { expire: 0 });
}
