import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUpcomingSets, SET_STATE, StartggApiError } from "@/lib/startgg";
import BetCard from "@/components/BetCard";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const session = await auth();
  if (!session?.user) return null;

  let sets: Awaited<ReturnType<typeof getUpcomingSets>> = [];
  let error: string | null = null;
  try {
    sets = await getUpcomingSets();
  } catch (err) {
    error = err instanceof StartggApiError ? err.message : "Erreur inconnue.";
  }

  const userBets = await prisma.bet.findMany({
    where: { userId: session.user.id },
  });
  const betBySetId = new Map(userBets.map((bet) => [bet.setId, bet]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Matchs à venir</h1>

      {error && (
        <div className="card p-4" style={{ color: "var(--lose)" }}>
          Impossible de récupérer les matchs depuis start.gg : {error}
        </div>
      )}

      {!error && sets.length === 0 && (
        <p style={{ color: "var(--muted)" }}>Aucun match à venir pour le moment.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sets.map((set) => {
          const entrants = set.slots
            .map((slot) => slot.entrant)
            .filter((entrant): entrant is { id: string; name: string } => entrant !== null);
          const bet = betBySetId.get(set.id);

          return (
            <BetCard
              key={set.id}
              setId={set.id}
              roundText={set.fullRoundText}
              entrants={entrants}
              locked={set.state !== SET_STATE.NOT_STARTED}
              existingBetEntrantName={bet?.predictedEntrantName ?? null}
            />
          );
        })}
      </div>
    </div>
  );
}
