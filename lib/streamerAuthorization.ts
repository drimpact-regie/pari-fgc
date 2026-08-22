import { prisma } from "@/lib/prisma";

export type ChannelAuthorizationStatus = "current" | "outdated" | "unknown";

/**
 * Accès à l'espace streamer/régie (impactobot.fr) : réservé aux admins et
 * aux chaînes Twitch explicitement autorisées (AuthorizedStreamer, gérée
 * depuis /admin/streamers), matchées via l'id Twitch numérique déjà associé
 * au compte connecté (User.twitchId, rempli à la connexion via Twitch ou au
 * premier pari via chat) — pas de compte Twitch lié = pas d'accès, même
 * pour une chaîne autorisée, tant que la personne ne s'est pas connectée.
 */
export async function isAuthorizedStreamer(user: {
  isAdmin: boolean;
  twitchId: string | null;
}): Promise<boolean> {
  if (user.isAdmin) return true;
  if (!user.twitchId) return false;

  const entry = await prisma.authorizedStreamer.findUnique({
    where: { twitchUserId: user.twitchId },
  });
  return entry !== null;
}

/**
 * Compare le compte qui jouait le rôle du bot au moment où une chaîne a
 * complété le flux self-service (StreamerChannelAuthorization.botLoginAtGrant)
 * au compte bot actuellement connecté (TwitchBotToken.login) :
 * - "current" : autorisée pour le compte bot actif, rien à faire.
 * - "outdated" : autorisée pour un ancien compte bot (ex. le compte
 *   personnel de l'admin avant la bascule vers un compte de service dédié)
 *   — à réautoriser.
 * - "unknown" : aucune trace du flux self-service pour cette chaîne (ex.
 *   autorisée via l'ancienne méthode "ajouter le bot modérateur", qui ne
 *   laisse aucune trace côté site) ou bot pas encore connecté — impossible
 *   de savoir sans vérifier manuellement.
 */
export function computeChannelAuthorizationStatus(
  authorization: { botLoginAtGrant: string } | null,
  currentBotLogin: string | null,
): ChannelAuthorizationStatus {
  if (!authorization || !currentBotLogin) return "unknown";
  return authorization.botLoginAtGrant === currentBotLogin ? "current" : "outdated";
}
