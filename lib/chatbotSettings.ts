import { prisma } from "@/lib/prisma";

/**
 * Une fonctionnalité par bascule exposée dans /admin/chatbot, dans l'ordre
 * d'affichage souhaité. `key` correspond au champ booléen de ChatbotSettings.
 */
export const CHATBOT_FEATURES = [
  {
    key: "helpEnabled",
    label: "Aide (!bet aide)",
    description: "Répond avec la liste des commandes sur \"!bet\", \"!bet aide\" ou \"!bet help\".",
  },
  {
    key: "classicBetEnabled",
    label: "Pari classique (!bet <joueur>)",
    description: "Pari sur le vainqueur d'un match de tournoi start.gg, mise fixe, depuis le chat.",
  },
  {
    key: "invitationalBetEnabled",
    label: "Pari classique — events Invitational",
    description: "Même pari classique, mais sur les showmatchs Invitational/Prestataire (sans start.gg).",
  },
  {
    key: "mvcBetEnabled",
    label: "Pari MVC (!bet mvc <perso> <0-8>)",
    description: "Deviner le nombre d'apparitions d'un personnage dans le top 8. Compte Twitch lié requis.",
  },
  {
    key: "resetBetEnabled",
    label: "Pari Reset de bracket (!bet reset oui|non)",
    description: "Pari oui/non sur un second set en grande finale. Compte Twitch lié requis.",
  },
  {
    key: "top8BetEnabled",
    label: "Pronostic Top 8 (!bet top8 / !top8)",
    description: "Pronostic des 8 joueurs qui termineront dans le top 8 du tournoi.",
  },
  {
    key: "autoAnnounceEnabled",
    label: "Annonces automatiques de résultats",
    description: "Poste dans le chat les résultats des matchs notables (phases finales, têtes de série).",
  },
  {
    key: "autoResolveEnabled",
    label: "Résolution automatique des paris",
    description:
      "Résout les paris classiques en attente dès qu'un message de chat arrive et qu'un match est terminé (le cron de secours continue de tourner même désactivé).",
  },
  {
    key: "leaderboardClimbEnabled",
    label: "Alertes de progression au classement",
    description: "Annonce dans le chat un parieur qui monte au classement LeaderBet du tournoi suite à un gain.",
  },
] as const;

export type ChatbotFeatureKey = (typeof CHATBOT_FEATURES)[number]["key"];

/** Juste les bascules de fonctionnalités (pas id/updatedAt), seul sous-ensemble dont le reste du code a besoin. */
export type ChatbotFeatureFlags = Record<ChatbotFeatureKey, boolean>;

/** Utilisée si la ligne singleton est introuvable (ne devrait pas arriver, la migration la crée) : tout reste activé par défaut. */
const FAIL_OPEN_DEFAULTS: ChatbotFeatureFlags = {
  helpEnabled: true,
  classicBetEnabled: true,
  invitationalBetEnabled: true,
  mvcBetEnabled: true,
  resetBetEnabled: true,
  top8BetEnabled: true,
  autoAnnounceEnabled: true,
  autoResolveEnabled: true,
  leaderboardClimbEnabled: true,
};

export async function getChatbotSettings(): Promise<ChatbotFeatureFlags> {
  const settings = await prisma.chatbotSettings.findUnique({ where: { id: "singleton" } });
  return settings ?? FAIL_OPEN_DEFAULTS;
}
