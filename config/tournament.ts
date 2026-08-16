/**
 * Configuration liée aux tournois start.gg suivis par l'application.
 *
 * Les tournois sont gérés dynamiquement en base (table Tournament, ajoutés
 * depuis /admin/tournaments) — ne JAMAIS coder un slug de tournoi en dur
 * ailleurs dans le code. Les constantes ci-dessous ne servent qu'à amorcer
 * le tout premier tournoi au premier démarrage de l'app (voir
 * lib/tournaments.ts), quand la table Tournament est encore vide.
 *
 * Le slug d'event start.gg correspond à la partie d'URL après
 * "https://www.start.gg/" — par exemple pour
 * https://www.start.gg/tournament/ceo-2026/event/marvel-tokon-fighting-souls
 * le slug est "tournament/ceo-2026/event/marvel-tokon-fighting-souls".
 */

const DEFAULT_EVENT_SLUG =
  "tournament/ceo-2026/event/marvel-tokon-fighting-souls";

export const STARTGG_EVENT_SLUG =
  process.env.STARTGG_EVENT_SLUG?.trim() || DEFAULT_EVENT_SLUG;

/** Nom d'affichage du tournoi amorcé au premier démarrage. */
export const DEFAULT_TOURNAMENT_NAME =
  process.env.DEFAULT_TOURNAMENT_NAME?.trim() || "CEO 2026";

/** Nombre de places disponibles pour le cercle fermé de parieurs (phase 1). */
export const MAX_USERS = Number(process.env.MAX_USERS ?? 30);

/**
 * URL publique du site, utilisée pour construire des liens cliquables dans
 * les réponses du bot Twitch (ex. lien vers la page de liaison de compte).
 * Laissé vide en dev — les messages du bot s'adaptent (texte sans lien).
 */
export const SITE_URL = process.env.SITE_URL?.trim().replace(/\/+$/, "") || "";

/**
 * Solde de départ (en Ex, la monnaie virtuelle unique du site) crédité à la
 * création d'un compte. Doit rester synchronisé avec le défaut de la
 * colonne User.exBalance côté schéma Prisma (les valeurs par défaut SQL ne
 * peuvent pas référencer une constante TypeScript). Les comptes déjà
 * existants au moment de l'introduction d'Ex reçoivent à la place la somme
 * de leurs gains déjà accumulés — voir lib/exMigration.ts.
 */
export const DEFAULT_STARTING_EX = Number(process.env.DEFAULT_STARTING_EX ?? 10000);

/**
 * Cote de repli (format décimal, équivalent à un 50/50) utilisée quand un
 * seed est manquant, égal entre les deux joueurs, ou invalide (0/négatif —
 * division par zéro sinon) — voir lib/odds.ts.
 */
export const FALLBACK_ODDS = 2.0;

/**
 * Points "Le Pari du Parry" : prono Top 8 pondéré par placement réel, MVC
 * (personnage) et reset de bracket. Classement séparé du LeaderBet des
 * paris sur matchs.
 */
export const PARRY_POINTS = {
  /** Points par placement réel d'un joueur pronostiqué dans le Top 8. */
  top8ByPlacement: { 1: 10, 2: 8, 3: 6, 4: 6, 5: 3, 6: 3, 7: 3, 8: 3 } as Record<number, number>,
  /** Points si le nombre d'apparitions du personnage MVC est deviné exactement (pas de barème dégressif). */
  mvcExact: 8,
  /** Points si le pari "reset de bracket" (oui/non) est correct. */
  bracketReset: 4,
};

/**
 * Durée (en secondes) pendant laquelle les réponses de l'API start.gg
 * (matchs à venir, stats joueurs) sont mises en cache côté serveur avant
 * d'être rafraîchies. Évite de saturer le rate-limit de l'API pour un
 * cercle de parieurs qui rafraîchit la page régulièrement.
 */
export const STARTGG_CACHE_SECONDS = Number(
  process.env.STARTGG_CACHE_SECONDS ?? 30,
);
