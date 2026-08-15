import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

/**
 * Récupère (ou crée) le compte associé à cette identité Twitch — sert à la
 * fois au pari via chat et à la connexion/inscription via Twitch sur le
 * site. Le pseudo souhaité peut déjà être pris par un compte distinct
 * (identifiants classiques) : on suffixe plutôt que d'échouer.
 */
export async function ensureUserByTwitchId(twitchId: string, preferredUsername: string): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { twitchId } });
  if (existing) return existing;

  const baseUsername = preferredUsername.trim() || `twitch-${twitchId}`;
  try {
    return await prisma.user.create({ data: { username: baseUsername, twitchId } });
  } catch (err: unknown) {
    const isUniqueViolation =
      err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002";
    if (!isUniqueViolation) throw err;
    return prisma.user.create({
      data: { username: `${baseUsername}-tw${twitchId.slice(-4)}`, twitchId },
    });
  }
}
