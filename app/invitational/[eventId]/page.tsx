import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeStreakOdds } from "@/lib/invitationalOdds";
import InvitationalBetCard from "@/components/InvitationalBetCard";
import type { InvitationalBet } from "@prisma/client";

export const dynamic = "force-dynamic";

const FORMAT_LABELS: Record<string, string> = {
  BRACKET_SINGLE: "Bracket simple élimination",
  BRACKET_DOUBLE: "Bracket double élimination",
  ROUND_ROBIN: "Round robin",
  SWISS: "Suisse",
  POOLS: "Poules",
  LIST: "Liste de matchs",
};

function buildExistingBet(bet: InvitationalBet | undefined) {
  if (!bet) return null;
  return {
    competitorName: bet.predictedCompetitorName,
    stake: bet.stake,
    odds: bet.odds,
    status: bet.status,
    payout: bet.pointsAwarded,
  };
}

export default async function InvitationalEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?from=%2Finvitational");
  }

  const { eventId } = await params;
  const event = await prisma.invitationalEvent.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  const [matches, userBets, currentUser] = await Promise.all([
    prisma.invitationalMatch.findMany({
      where: { eventId },
      include: { competitorA: true, competitorB: true },
      orderBy: [{ groupLabel: "asc" }, { orderIndex: "asc" }],
    }),
    prisma.invitationalBet.findMany({ where: { userId: session.user.id, eventId } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { invitationalExBalance: true } }),
  ]);
  const betByMatchId = new Map(userBets.map((bet) => [bet.matchId, bet]));
  const exBalance = currentUser?.invitationalExBalance ?? 0;

  const groups = new Map<string, typeof matches>();
  for (const match of matches) {
    const key = match.groupLabel ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(match);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">{event.name}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {new Date(event.eventDate).toLocaleDateString("fr-FR")} · {FORMAT_LABELS[event.format] ?? event.format}
          </p>
        </div>
        <span className="font-semibold" style={{ color: "var(--gold)" }}>
          {exBalance} Ex
        </span>
      </div>

      {matches.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Aucun match pour cet event.
        </p>
      ) : (
        Array.from(groups.entries()).map(([groupLabel, groupMatches]) => (
          <div key={groupLabel || "__default"} className="flex flex-col gap-3">
            {groupLabel && <h2 className="text-sm font-semibold">{groupLabel}</h2>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {groupMatches.map((match) => {
                const odds =
                  match.competitorA && match.competitorB
                    ? computeStreakOdds(match.competitorA.currentStreak, match.competitorB.currentStreak)
                    : null;
                return (
                  <InvitationalBetCard
                    key={match.id}
                    matchId={match.id}
                    competitorA={
                      match.competitorA && odds ? { ...match.competitorA, odds: odds.oddsA } : null
                    }
                    competitorB={
                      match.competitorB && odds ? { ...match.competitorB, odds: odds.oddsB } : null
                    }
                    placeholderA={match.competitorA ? null : match.placeholderA}
                    placeholderB={match.competitorB ? null : match.placeholderB}
                    locked={match.status !== "OPEN"}
                    exBalance={exBalance}
                    existingBet={buildExistingBet(betByMatchId.get(match.id))}
                  />
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
