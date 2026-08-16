import { prisma } from "@/lib/prisma";
import { computeMatchBetPayout } from "@/lib/odds";

export class InvitationalResultError extends Error {}

/**
 * Déclare le résultat d'un match invitational — 100% piloté par un admin
 * (aucune détection automatique, contrairement aux tournois classiques :
 * ces events n'existent pas côté start.gg). Dans une seule transaction :
 * marque le match COMPLETED avec le score, met à jour la série de
 * victoires des deux compétiteurs (gagnant +1, perdant remis à 0 — voir
 * lib/invitationalOdds.ts pour comment cette série pilote la cote des
 * prochains matchs de l'event), puis résout tous les paris InvitationalBet
 * en attente sur ce match (gain crédité sur invitationalExBalance, jamais
 * sur exBalance).
 *
 * Idempotent au niveau des paris (ne touche que les paris encore PENDING),
 * mais pas au niveau du match/des séries : appeler deux fois avec des
 * résultats différents écraserait la série déjà incrémentée — l'admin ne
 * doit déclarer un résultat qu'une fois par match (l'UI verrouille le
 * match une fois COMPLETED, voir /admin/invitational/[eventId]).
 */
export async function declareInvitationalMatchResult(
  matchId: string,
  input: { winnerId: string; scoreA: number | null; scoreB: number | null },
): Promise<{ resolvedBets: number }> {
  const match = await prisma.invitationalMatch.findUnique({ where: { id: matchId } });
  if (!match) throw new InvitationalResultError("Match introuvable.");
  if (!match.competitorAId || !match.competitorBId) {
    throw new InvitationalResultError("Les deux compétiteurs doivent être renseignés avant de déclarer un résultat.");
  }
  if (input.winnerId !== match.competitorAId && input.winnerId !== match.competitorBId) {
    throw new InvitationalResultError("Le vainqueur doit être l'un des deux compétiteurs de ce match.");
  }

  const loserId = input.winnerId === match.competitorAId ? match.competitorBId : match.competitorAId;

  await prisma.$transaction([
    prisma.invitationalMatch.update({
      where: { id: matchId },
      data: {
        status: "COMPLETED",
        winnerId: input.winnerId,
        scoreA: input.scoreA,
        scoreB: input.scoreB,
        resolvedAt: new Date(),
      },
    }),
    prisma.invitationalCompetitor.update({
      where: { id: input.winnerId },
      data: { currentStreak: { increment: 1 } },
    }),
    prisma.invitationalCompetitor.update({
      where: { id: loserId },
      data: { currentStreak: 0 },
    }),
  ]);

  const pendingBets = await prisma.invitationalBet.findMany({
    where: { matchId, status: "PENDING" },
  });

  for (const bet of pendingBets) {
    const won = bet.predictedCompetitorId === input.winnerId;
    const payout = won ? computeMatchBetPayout({ won, stake: bet.stake, odds: bet.odds }) : 0;

    await prisma.$transaction([
      prisma.invitationalBet.update({
        where: { id: bet.id },
        data: { status: won ? "WON" : "LOST", pointsAwarded: payout, resolvedAt: new Date() },
      }),
      ...(payout > 0
        ? [
            prisma.user.update({
              where: { id: bet.userId },
              data: { invitationalExBalance: { increment: payout } },
            }),
          ]
        : []),
    ]);
  }

  return { resolvedBets: pendingBets.length };
}
