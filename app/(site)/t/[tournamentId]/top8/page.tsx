import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTournament } from "@/lib/tournaments";
import { getEventEntrants, getStandings, StartggApiError } from "@/lib/startgg";
import Top8PickForm, { type PickStatus } from "@/components/Top8PickForm";

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

export default async function Top8Page({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const tournament = await getTournament(tournamentId);
  if (!tournament) notFound();

  let entrants: { id: string; name: string }[] = [];
  let placementById = new Map<string, number | null>();
  let error: string | null = null;
  try {
    // On liste les joueurs à partir des inscrits (disponibles dès la
    // clôture des inscriptions), pas du classement (`standings`) qui ne se
    // remplit qu'une fois des sets terminés — sinon impossible de faire un
    // pronostic tant que le bracket n'a pas commencé.
    const [rawEntrants, standings] = await Promise.all([
      getEventEntrants(tournament.eventSlug),
      getStandings(tournament.eventSlug),
    ]);
    entrants = rawEntrants.map((e) => ({ id: e.id, name: e.name }));
    placementById = new Map(
      standings.filter((s) => s.entrant).map((s) => [s.entrant!.id, s.placement]),
    );
  } catch (err) {
    error = err instanceof StartggApiError ? err.message : "Erreur inconnue.";
  }

  const [myPick, allPicks] = await Promise.all([
    prisma.topEightPick.findUnique({
      where: { userId_eventSlug: { userId: session.user.id, eventSlug: tournament.eventSlug } },
    }),
    prisma.topEightPick.findMany({
      where: { eventSlug: tournament.eventSlug },
      include: { user: { select: { username: true } } },
    }),
  ]);

  const initialPicks: StoredPick[] = (myPick?.picks as unknown as StoredPick[] | undefined) ?? [];
  const statusByEntrantId: Record<string, PickStatus> = {};
  for (const pick of initialPicks) {
    statusByEntrantId[pick.entrantId] = statusFor(pick.entrantId, placementById);
  }

  const board = allPicks
    .map((p) => {
      const picks = (p.picks as unknown as StoredPick[]) ?? [];
      const statuses = picks.map((pick) => statusFor(pick.entrantId, placementById));
      const correct = statuses.filter((s) => s === "correct").length;
      return { username: p.user.username, statuses, correct, total: picks.length };
    })
    .sort((a, b) => b.correct - a.correct);

  const STATUS_ICON: Record<PickStatus, string> = { correct: "🟩", wrong: "🟥", pending: "⬜" };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Pronostiquez les 8 joueurs qui, selon vous, termineront dans le top 8 du tournoi.
        Cases vertes si confirmé dans le top 8, rouges si éliminé avant, en attente sinon.
      </p>

      {error && (
        <div className="card p-4" style={{ color: "var(--lose)" }}>
          Impossible de récupérer la liste des joueurs depuis start.gg : {error}
        </div>
      )}

      {!error && entrants.length === 0 && (
        <div className="card p-4 text-sm" style={{ color: "var(--muted)" }}>
          Aucun joueur inscrit pour le moment sur start.gg pour ce tournoi.
        </div>
      )}

      {!error && entrants.length > 0 && (
        <Top8PickForm
          tournamentId={tournamentId}
          entrants={entrants}
          initialPicks={initialPicks.map((p) => ({ id: p.entrantId, name: p.entrantName }))}
          locked={tournament.topEightLocked}
          statusByEntrantId={statusByEntrantId}
        />
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left"
              style={{ background: "var(--surface-alt)", color: "var(--muted)" }}
            >
              <th className="px-4 py-2 font-medium">Parieur</th>
              <th className="px-4 py-2 font-medium">Pronostics</th>
              <th className="px-4 py-2 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {board.map((row) => (
              <tr key={row.username} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-2 font-medium">{row.username}</td>
                <td className="px-4 py-2 font-mono tracking-widest">
                  {row.statuses.map((s) => STATUS_ICON[s]).join("")}
                </td>
                <td className="px-4 py-2" style={{ color: "var(--accent)" }}>
                  {row.correct}/{row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {board.length === 0 && (
          <p className="p-4 text-sm" style={{ color: "var(--muted)" }}>
            Personne n&apos;a encore fait de pronostic Top 8 sur ce tournoi.
          </p>
        )}
      </div>
    </div>
  );
}
