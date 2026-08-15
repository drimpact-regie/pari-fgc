import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTournament } from "@/lib/tournaments";
import {
  getCompletedSets,
  getEventInfo,
  getStandings,
  getUpcomingSets,
  isMvcLocked,
  StartggApiError,
} from "@/lib/startgg";
import { computeTop8PickPoints } from "@/lib/scoring";
import Top8PickForm, { type PickStatus } from "@/components/Top8PickForm";
import MvcBetForm from "@/components/MvcBetForm";
import BracketResetBetForm from "@/components/BracketResetBetForm";
import LeaderboardTable from "@/components/LeaderboardTable";

export const dynamic = "force-dynamic";

interface StoredPick {
  entrantId: string;
  entrantName: string;
}

function statusFor(entrantId: string, placementById: Map<string, number | null>): PickStatus {
  const placement = placementById.get(entrantId);
  if (placement == null) return "pending";
  return placement <= 8 ? "correct" : "wrong";
}

export default async function ParryPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const tournament = await getTournament(tournamentId);
  if (!tournament) notFound();

  let standings: Awaited<ReturnType<typeof getStandings>> = [];
  let error: string | null = null;
  let mvcLocked = tournament.topEightLocked;
  let videogameName: string | null = null;
  try {
    const [standingsResult, completedSets, upcomingSets, eventInfo] = await Promise.all([
      getStandings(tournament.eventSlug),
      getCompletedSets(tournament.eventSlug),
      getUpcomingSets(tournament.eventSlug),
      getEventInfo(tournament.eventSlug),
    ]);
    standings = standingsResult;
    mvcLocked = isMvcLocked([...upcomingSets, ...completedSets], tournament.topEightLocked);
    videogameName = eventInfo?.videogameName ?? null;
  } catch (err) {
    error = err instanceof StartggApiError ? err.message : "Erreur inconnue.";
  }

  const entrants = standings
    .filter((s) => s.entrant)
    .map((s) => ({ id: s.entrant!.id, name: s.entrant!.name }));
  const placementById = new Map(
    standings.filter((s) => s.entrant).map((s) => [s.entrant!.id, s.placement]),
  );

  const [myPick, allPicks, myMvcBet, allMvcBets, myBracketBet, allBracketBets, characters] =
    await Promise.all([
      prisma.topEightPick.findUnique({
        where: { userId_eventSlug: { userId: session.user.id, eventSlug: tournament.eventSlug } },
      }),
      prisma.topEightPick.findMany({
        where: { eventSlug: tournament.eventSlug },
        include: { user: { select: { username: true } } },
      }),
      prisma.mvcBet.findUnique({
        where: { userId_eventSlug: { userId: session.user.id, eventSlug: tournament.eventSlug } },
        include: { character: true },
      }),
      prisma.mvcBet.findMany({
        where: { eventSlug: tournament.eventSlug },
        include: { user: { select: { username: true } } },
      }),
      prisma.bracketResetBet.findUnique({
        where: { userId_eventSlug: { userId: session.user.id, eventSlug: tournament.eventSlug } },
      }),
      prisma.bracketResetBet.findMany({
        where: { eventSlug: tournament.eventSlug },
        include: { user: { select: { username: true } } },
      }),
      videogameName
        ? prisma.character.findMany({ where: { game: videogameName }, orderBy: { name: "asc" } })
        : Promise.resolve([]),
    ]);

  const initialPicks: StoredPick[] = (myPick?.picks as unknown as StoredPick[] | undefined) ?? [];
  const statusByEntrantId: Record<string, PickStatus> = {};
  for (const pick of initialPicks) {
    statusByEntrantId[pick.entrantId] = statusFor(pick.entrantId, placementById);
  }

  // Classement combiné "Le Pari du Parry" : Top 8 (points pondérés, calculés
  // à la volée depuis les placements actuels) + MVC + reset de bracket
  // (points déjà résolus et persistés par un admin).
  const pointsByUsername = new Map<string, number>();
  const addPoints = (username: string, points: number) => {
    pointsByUsername.set(username, (pointsByUsername.get(username) ?? 0) + points);
  };

  for (const pick of allPicks) {
    const picks = (pick.picks as unknown as StoredPick[]) ?? [];
    const points = picks.reduce(
      (sum, p) => sum + computeTop8PickPoints(placementById.get(p.entrantId) ?? null),
      0,
    );
    addPoints(pick.user.username, points);
  }
  for (const bet of allMvcBets) {
    addPoints(bet.user.username, bet.pointsAwarded);
  }
  for (const bet of allBracketBets) {
    addPoints(bet.user.username, bet.pointsAwarded);
  }

  const leaderboardRows = Array.from(pointsByUsername.entries())
    .map(([username, points]) => ({ username, points }))
    .sort((a, b) => b.points - a.points);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Le Pari du Parry regroupe le prono Top 8, le MVC (personnage) et le reset de
        bracket — un classement dédié, séparé du LeaderBet des paris sur matchs.
      </p>

      {error && (
        <div className="card p-4" style={{ color: "var(--lose)" }}>
          Impossible de récupérer la liste des joueurs depuis start.gg : {error}
        </div>
      )}

      {!error && (
        <Top8PickForm
          tournamentId={tournamentId}
          entrants={entrants}
          initialPicks={initialPicks.map((p) => ({ id: p.entrantId, name: p.entrantName }))}
          locked={tournament.topEightLocked}
          statusByEntrantId={statusByEntrantId}
        />
      )}

      <MvcBetForm
        tournamentId={tournamentId}
        characters={characters}
        locked={mvcLocked}
        initialCharacter={myMvcBet?.character ?? null}
        initialPredictedCount={myMvcBet?.predictedCount ?? null}
        actualCount={myMvcBet?.actualCount ?? null}
      />

      <BracketResetBetForm
        tournamentId={tournamentId}
        locked={tournament.bracketResetLocked}
        initialPrediction={myBracketBet?.predictedYes ?? null}
        actualYes={tournament.bracketResetActual}
      />

      <LeaderboardTable
        rows={leaderboardRows}
        emptyLabel="Personne n'a encore parié sur Le Pari du Parry pour ce tournoi."
        showRecordColumns={false}
      />
    </div>
  );
}
