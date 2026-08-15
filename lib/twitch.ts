/**
 * Client pour l'API Twitch (Helix + EventSub) — sert au pari via chat
 * ("!bet NomJoueur" dans le tchat Twitch d'un tournoi).
 *
 * Deux notions de jeton distinctes :
 * - Jeton "app" (client_credentials) : sert à créer/supprimer les
 *   abonnements EventSub et à interroger l'API Helix générale. Récupéré à
 *   la volée, pas persisté (coût négligeable, évite une table de plus).
 * - Jeton "bot" (authorization_code, scope user:read:chat) : appartient au
 *   compte Twitch utilisé comme bot, doit avoir été autorisé une fois par
 *   ce compte (flux OAuth /api/admin/twitch/connect) et éventuellement
 *   promu modérateur sur la chaîne suivie. Persisté en base (TwitchBotToken)
 *   car le refresh token change à chaque rafraîchissement.
 */

import { createHmac, timingSafeEqual } from "crypto";

import { prisma } from "@/lib/prisma";

const TWITCH_API_URL = "https://api.twitch.tv/helix";
const TWITCH_OAUTH_URL = "https://id.twitch.tv/oauth2";

/**
 * Vérifie la signature HMAC d'une notification EventSub webhook, pour
 * s'assurer que la requête vient bien de Twitch et pas d'un tiers qui
 * aurait deviné l'URL du webhook.
 * https://dev.twitch.tv/docs/eventsub/handling-webhook-events/#verifying-the-event-message
 */
export function verifyWebhookSignature(params: {
  messageId: string;
  timestamp: string;
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
}): boolean {
  if (!params.signatureHeader) return false;

  const hmac = createHmac("sha256", params.secret);
  hmac.update(params.messageId + params.timestamp + params.rawBody);
  const expected = `sha256=${hmac.digest("hex")}`;

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(params.signatureHeader);
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

export class TwitchApiError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "TwitchApiError";
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new TwitchApiError(`${name} n'est pas défini dans l'environnement du serveur.`);
  }
  return value;
}

// --- Jeton applicatif (client_credentials) ----------------------------------

async function getAppAccessToken(): Promise<string> {
  const clientId = requireEnv("TWITCH_CLIENT_ID");
  const clientSecret = requireEnv("TWITCH_CLIENT_SECRET");

  const res = await fetch(
    `${TWITCH_OAUTH_URL}/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
    { method: "POST" },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new TwitchApiError(`Impossible d'obtenir un jeton applicatif Twitch (${res.status}).`, text);
  }

  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

// --- Jeton du compte bot (persisté, rafraîchi au besoin) --------------------

export interface BotToken {
  accessToken: string;
  userId: string;
  login: string;
}

/** Échange un code d'autorisation OAuth contre les jetons du compte bot. */
export async function exchangeBotAuthCode(code: string, redirectUri: string): Promise<void> {
  const clientId = requireEnv("TWITCH_CLIENT_ID");
  const clientSecret = requireEnv("TWITCH_CLIENT_SECRET");

  const res = await fetch(`${TWITCH_OAUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new TwitchApiError(`Échange du code d'autorisation Twitch échoué (${res.status}).`, text);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Identifie le compte qui vient d'autoriser l'appli.
  const usersRes = await fetch(`${TWITCH_API_URL}/users`, {
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${json.access_token}`,
    },
  });
  if (!usersRes.ok) {
    throw new TwitchApiError(`Impossible de récupérer le compte Twitch du bot (${usersRes.status}).`);
  }
  const usersJson = (await usersRes.json()) as { data: { id: string; login: string }[] };
  const user = usersJson.data[0];
  if (!user) {
    throw new TwitchApiError("Aucun compte Twitch renvoyé après autorisation.");
  }

  await prisma.twitchBotToken.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      twitchUserId: user.id,
      login: user.login,
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: new Date(Date.now() + json.expires_in * 1000),
    },
    update: {
      twitchUserId: user.id,
      login: user.login,
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: new Date(Date.now() + json.expires_in * 1000),
    },
  });
}

/**
 * Échange un code d'autorisation OAuth contre l'identité Twitch de
 * l'utilisateur qui vient d'autoriser l'appli — sert à lier un compte
 * Impact'O Bet à son compte Twitch (pari via chat), sans persister de
 * jeton (contrairement au compte bot, on n'a pas besoin de rappeler l'API
 * en tant que cet utilisateur par la suite).
 */
export async function exchangeUserAuthCode(
  code: string,
  redirectUri: string,
): Promise<TwitchUser> {
  const clientId = requireEnv("TWITCH_CLIENT_ID");
  const clientSecret = requireEnv("TWITCH_CLIENT_SECRET");

  const res = await fetch(`${TWITCH_OAUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new TwitchApiError(`Échange du code d'autorisation Twitch échoué (${res.status}).`, text);
  }

  const json = (await res.json()) as { access_token: string };

  const usersRes = await fetch(`${TWITCH_API_URL}/users`, {
    headers: { "Client-Id": clientId, Authorization: `Bearer ${json.access_token}` },
  });
  if (!usersRes.ok) {
    throw new TwitchApiError(`Impossible de récupérer le compte Twitch (${usersRes.status}).`);
  }
  const usersJson = (await usersRes.json()) as {
    data: { id: string; login: string; display_name: string }[];
  };
  const user = usersJson.data[0];
  if (!user) {
    throw new TwitchApiError("Aucun compte Twitch renvoyé après autorisation.");
  }

  return { id: user.id, login: user.login, displayName: user.display_name };
}

/** Renvoie un jeton bot valide, en le rafraîchissant en base si besoin. */
export async function getValidBotToken(): Promise<BotToken | null> {
  const stored = await prisma.twitchBotToken.findUnique({ where: { id: "singleton" } });
  if (!stored) return null;

  const FIVE_MIN_MS = 5 * 60 * 1000;
  if (stored.expiresAt.getTime() > Date.now() + FIVE_MIN_MS) {
    return { accessToken: stored.accessToken, userId: stored.twitchUserId, login: stored.login };
  }

  const clientId = requireEnv("TWITCH_CLIENT_ID");
  const clientSecret = requireEnv("TWITCH_CLIENT_SECRET");

  const res = await fetch(`${TWITCH_OAUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: stored.refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new TwitchApiError(
      `Rafraîchissement du jeton bot Twitch échoué (${res.status}) — reconnectez le bot depuis /admin/tournaments.`,
      text,
    );
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  await prisma.twitchBotToken.update({
    where: { id: "singleton" },
    data: {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: new Date(Date.now() + json.expires_in * 1000),
    },
  });

  return { accessToken: json.access_token, userId: stored.twitchUserId, login: stored.login };
}

// --- Helix -------------------------------------------------------------------

export interface TwitchUser {
  id: string;
  login: string;
  displayName: string;
}

export async function getTwitchUserByLogin(login: string): Promise<TwitchUser | null> {
  const clientId = requireEnv("TWITCH_CLIENT_ID");
  const appToken = await getAppAccessToken();

  const res = await fetch(`${TWITCH_API_URL}/users?login=${encodeURIComponent(login)}`, {
    headers: { "Client-Id": clientId, Authorization: `Bearer ${appToken}` },
  });

  if (!res.ok) {
    throw new TwitchApiError(`Recherche du compte Twitch "${login}" échouée (${res.status}).`);
  }

  const json = (await res.json()) as {
    data: { id: string; login: string; display_name: string }[];
  };
  const user = json.data[0];
  if (!user) return null;
  return { id: user.id, login: user.login, displayName: user.display_name };
}

/**
 * Crée l'abonnement EventSub "channel.chat.message" pour une chaîne. Le
 * compte bot doit être modérateur (ou avoir le scope channel:bot accordé
 * par le broadcaster) sur cette chaîne, sinon Twitch répond 403.
 *
 * Les abonnements EventSub en transport "webhook" exigent un jeton
 * applicatif (client_credentials) pour la création, même pour un type
 * "chat" dont le condition.user_id référence un compte utilisateur — ce
 * compte doit simplement avoir préalablement autorisé cette appli avec le
 * scope user:read:chat (fait via /api/admin/twitch/connect).
 */
export async function createChatSubscription(params: {
  broadcasterUserId: string;
  botUserId: string;
  callbackUrl: string;
  secret: string;
}): Promise<string> {
  const clientId = requireEnv("TWITCH_CLIENT_ID");
  const appToken = await getAppAccessToken();

  const res = await fetch(`${TWITCH_API_URL}/eventsub/subscriptions`, {
    method: "POST",
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${appToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "channel.chat.message",
      version: "1",
      condition: {
        broadcaster_user_id: params.broadcasterUserId,
        user_id: params.botUserId,
      },
      transport: {
        method: "webhook",
        callback: params.callbackUrl,
        secret: params.secret,
      },
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const twitchMessage = json?.message ? ` — Twitch dit : "${json.message}"` : "";
    throw new TwitchApiError(
      `Création de l'abonnement chat Twitch échouée (${res.status})${twitchMessage}`,
      json,
    );
  }

  return json.data[0].id as string;
}

/**
 * Envoie un message dans le chat d'une chaîne, en tant que compte bot.
 * Nécessite le scope user:write:chat sur le jeton bot — n'échoue jamais
 * bruyamment (best-effort) : si le bot n'est pas connecté ou que l'envoi
 * échoue, on préfère un pari silencieux à une erreur qui casse le webhook.
 */
export async function sendChatMessage(params: {
  broadcasterId: string;
  message: string;
}): Promise<void> {
  const clientId = requireEnv("TWITCH_CLIENT_ID");
  const bot = await getValidBotToken();
  if (!bot) return;

  await fetch(`${TWITCH_API_URL}/chat/messages`, {
    method: "POST",
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${bot.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      broadcaster_id: params.broadcasterId,
      sender_id: bot.userId,
      message: params.message,
    }),
  }).catch(() => undefined);
}

export async function deleteSubscription(subscriptionId: string): Promise<void> {
  const clientId = requireEnv("TWITCH_CLIENT_ID");
  const appToken = await getAppAccessToken();

  await fetch(`${TWITCH_API_URL}/eventsub/subscriptions?id=${encodeURIComponent(subscriptionId)}`, {
    method: "DELETE",
    headers: { "Client-Id": clientId, Authorization: `Bearer ${appToken}` },
  }).catch(() => undefined);
}
