import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createChatSubscription,
  deleteSubscription,
  getTwitchUserByLogin,
  getValidBotToken,
  TwitchApiError,
} from "@/lib/twitch";
import { requestOrigin } from "@/lib/domainRouting";

/**
 * Active le pari via chat pour ce tournoi : crée l'abonnement EventSub
 * "channel.chat.message" sur sa chaîne Twitch. Remplace un éventuel
 * abonnement existant (recréation propre plutôt que double abonnement).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404 });
  }
  if (!tournament.twitchChannel) {
    return NextResponse.json(
      { error: "Renseignez d'abord une chaîne Twitch pour ce tournoi." },
      { status: 400 },
    );
  }

  const secret = process.env.TWITCH_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "TWITCH_WEBHOOK_SECRET n'est pas configuré." }, { status: 500 });
  }

  const bot = await getValidBotToken();
  if (!bot) {
    return NextResponse.json(
      { error: "Aucun bot Twitch connecté. Cliquez d'abord sur \"Connecter le bot Twitch\"." },
      { status: 400 },
    );
  }

  try {
    const broadcaster = await getTwitchUserByLogin(tournament.twitchChannel);
    if (!broadcaster) {
      return NextResponse.json(
        { error: `Chaîne Twitch "${tournament.twitchChannel}" introuvable.` },
        { status: 404 },
      );
    }

    if (tournament.twitchSubscriptionId) {
      await deleteSubscription(tournament.twitchSubscriptionId);
    }

    const callbackUrl = `${requestOrigin(request)}/api/twitch/webhook`;

    const subscriptionId = await createChatSubscription({
      broadcasterUserId: broadcaster.id,
      botUserId: bot.userId,
      callbackUrl,
      secret,
    });

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { twitchSubscriptionId: subscriptionId },
    });

    return NextResponse.json({ ok: true, subscriptionId });
  } catch (err) {
    const message = err instanceof TwitchApiError ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

