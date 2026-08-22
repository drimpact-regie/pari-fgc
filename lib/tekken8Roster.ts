/**
 * Roster TEKKEN 8, pour le pari "MVC" (Le Pari du Parry) — voir
 * app/api/admin/characters/import-tekken8/route.ts pour l'import.
 *
 * "TEKKEN 8" doit correspondre au champ event.videogame.name renvoyé par
 * l'API start.gg pour un event Tekken 8 (voir usage dans
 * app/api/twitch/webhook/route.ts : `Character.findMany({ where: { game } })`
 * avec `game = eventInfo.videogameName`) — confirmé via plusieurs pages
 * d'events Tekken 8 publiques sur start.gg, mais pas via un appel direct à
 * l'API GraphQL depuis cet environnement (pas d'accès réseau sortant vers
 * start.gg ici) : à vérifier sur le premier event Tekken 8 réellement
 * importé, et ajuster cette constante si le nom diffère.
 */
export const TEKKEN8_GAME_NAME = "TEKKEN 8";

/**
 * Roster complet au 22 août 2026 : les 32 combattants de base + les 8
 * personnages DLC des saisons 1 et 2, plus Kunimitsu (sortie le 27 mai 2026)
 * et Bob (déploiement saison 3 pass mi-août 2026, sortie générale ~24-25
 * août 2026 — inclus par anticipation, à retirer si pas encore disponible
 * au moment de l'import). Roger Jr. et Yujiro Hanma (autres personnages
 * saison 3) ne sont pas encore sortis et sont volontairement exclus.
 */
export const TEKKEN8_ROSTER: string[] = [
  // Base (32)
  "Jin Kazama",
  "Kazuya Mishima",
  "Paul Phoenix",
  "Marshall Law",
  "King",
  "Yoshimitsu",
  "Hwoarang",
  "Ling Xiaoyu",
  "Nina Williams",
  "Lee Chaolan",
  "Jack-8",
  "Asuka Kazama",
  "Devil Jin",
  "Feng Wei",
  "Lars Alexandersson",
  "Alisa Bosconovitch",
  "Claudio Serafino",
  "Shaheen",
  "Kuma",
  "Panda",
  "Bryan Fury",
  "Steve Fox",
  "Leroy Smith",
  "Jun Kazama",
  "Reina",
  "Azucena",
  "Victor Chevalier",
  "Raven",
  "Lili",
  "Sergei Dragunov",
  "Zafina",
  "Leo",
  // Saison 1 DLC (4)
  "Eddy Gordo",
  "Lidia",
  "Heihachi Mishima",
  "Clive Rosfield",
  // Saison 2 DLC (4)
  "Anna Williams",
  "Fahkumram",
  "Armor King",
  "Miary Zo",
  // Saison 3 (sortis à ce jour)
  "Kunimitsu",
  "Bob",
];
