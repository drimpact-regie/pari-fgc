import { randomUUID } from "crypto";
import { encode, decode } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";

/**
 * Pont SSO entre impactobet.fr et impactobot.fr.
 *
 * Un cookie ne traverse pas deux domaines sans parenté (impactobet.fr et
 * impactobot.fr n'ont pas de domaine parent commun) — "partager la
 * session" ne peut donc pas se faire en posant un cookie sur un domaine
 * parent. À la place : un jeton signé, à usage unique, valable quelques
 * secondes, transporté en paramètre d'URL lors d'une traversée de domaine ;
 * le domaine de destination le valide côté serveur puis pose SON PROPRE
 * cookie de session Auth.js pour le même utilisateur.
 *
 * Deux JWT bien distincts sont en jeu ici, chacun avec son propre "salt" :
 * - le jeton de pont lui-même (courte durée de vie, décodé une seule fois
 *   par /api/auth/bridge/complete), salt "sso-bridge" ;
 * - le cookie de session Auth.js final posé sur le domaine de destination,
 *   qui DOIT utiliser exactement le même salt que celui qu'Auth.js utilise
 *   pour son propre cookie de session — à savoir le nom du cookie
 *   lui-même (voir defaultCookies dans @auth/core/lib/utils/cookie.js).
 *   Un salt différent au décodage échoue silencieusement (retourne `null`,
 *   indiscernable d'un visiteur non connecté) : à ne jamais confondre.
 *
 * Les deux utilisent le même AUTH_SECRET existant (pas de nouvelle
 * variable d'environnement nécessaire).
 */

const BRIDGE_SALT = "sso-bridge";
const BRIDGE_MAX_AGE_SECONDS = 30;

interface BridgePayload {
  sub: string;
  bridgeId: string;
}

function requireSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET non configuré.");
  return secret;
}

export async function mintBridgeToken(userId: string): Promise<string> {
  const secret = requireSecret();
  const bridgeId = randomUUID();

  // La ligne en base est le mécanisme réel d'usage unique : sa suppression
  // atomique dans consumeBridgeToken() est ce qui empêche un rejeu, pas la
  // seule expiration du JWT (un jeton encore valide mais déjà consommé
  // doit être rejeté malgré une signature/expiration valides).
  await prisma.ssoBridgeToken.create({ data: { jti: bridgeId, userId } });

  return encode({
    token: { sub: userId, bridgeId } satisfies BridgePayload,
    secret,
    salt: BRIDGE_SALT,
    maxAge: BRIDGE_MAX_AGE_SECONDS,
  });
}

export async function consumeBridgeToken(
  token: string,
): Promise<{ id: string; username: string; isAdmin: boolean } | null> {
  const secret = requireSecret();

  let payload: BridgePayload | null;
  try {
    payload = (await decode({ token, secret, salt: BRIDGE_SALT })) as BridgePayload | null;
  } catch {
    return null;
  }
  if (!payload?.sub || !payload.bridgeId) return null;

  const deleted = await prisma.ssoBridgeToken.deleteMany({
    where: { jti: payload.bridgeId, userId: payload.sub },
  });
  if (deleted.count === 0) return null;

  return prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, username: true, isAdmin: true },
  });
}

/**
 * Nom du cookie de session Auth.js — voir defaultCookies() dans
 * @auth/core/lib/utils/cookie.js. Le pont ne s'active que pour de vrais
 * hôtes de production (voir bridgeHref/isDevOrPreviewHost), donc toujours
 * en HTTPS : on utilise systématiquement le préfixe "__Secure-".
 */
export const SESSION_COOKIE_NAME = "__Secure-authjs.session-token";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function encodeSessionToken(user: {
  id: string;
  isAdmin: boolean;
}): Promise<string> {
  const secret = requireSecret();
  return encode({
    token: { sub: user.id, id: user.id, isAdmin: user.isAdmin },
    secret,
    salt: SESSION_COOKIE_NAME,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}
