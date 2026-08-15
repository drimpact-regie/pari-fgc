import { notFound } from "next/navigation";

import { getTournament } from "@/lib/tournaments";
import {
  computeRecords,
  getCompletedSets,
  getPlayerRecentStandings,
  getStandings,
  StartggApiError,
  type PlayerHistoryEntry,
} from "@/lib/startgg";

export const dynamic = "force-dynamic";

const TOP_CUTOFF = 16;

export default async function PlayersPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const tournament = await getTournament(tournamentId);
  if (!tournament) notFound();

  let standings: Awaited<ReturnType<typeof getStandings>> = [];
  let records: ReturnType<typeof computeRecords> = new Map();
  let error: string | null = null;

  try {
    const [standingsResult, completedSets] = await Promise.all([
      getStandings(tournament.eventSlug),
      getCompletedSets(tournament.eventSlug),
    ]);
    standings = standingsResult;
    records = computeRecords(completedSets);
  } catch (err) {
    error = err instanceof StartggApiError ? err.message : "Erreur inconnue.";
  }

  // Classement simplifié: encore en course (pas de placement final) ou top 16.
  const topStandings = standings
    .filter((s) => s.entrant !== null)
    .filter((s) => s.placement === null || s.placement <= TOP_CUTOFF);

  const palmaresById = new Map<string, PlayerHistoryEntry[]>();
  if (!error) {
    await Promise.all(
      topStandings.map(async (standing) => {
        const playerId = standing.entrant!.playerId;
        if (!playerId) return;
        try {
          const history = await getPlayerRecentStandings(playerId, 5);
          palmaresById.set(standing.entrant!.id, history);
        } catch {
          // Palmarès indisponible pour ce joueur : on l'affiche simplement vide.
        }
      }),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="card p-4" style={{ color: "var(--lose)" }}>
          Impossible de récupérer les stats depuis start.gg : {error}
        </div>
      )}

      {!error && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left"
                style={{ background: "var(--surface-alt)", color: "var(--muted)" }}
              >
                <th className="px-4 py-2 font-medium">Placement</th>
                <th className="px-4 py-2 font-medium">Joueur</th>
                <th className="px-4 py-2 font-medium">Victoires</th>
                <th className="px-4 py-2 font-medium">Défaites</th>
                <th className="px-4 py-2 font-medium">Palmarès (5 derniers tournois)</th>
              </tr>
            </thead>
            <tbody>
              {topStandings.map((standing) => {
                const entrant = standing.entrant!;
                const record = records.get(entrant.id);
                const history = palmaresById.get(entrant.id) ?? [];
                return (
                  <tr key={entrant.id} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-2">{standing.placement ?? "—"}</td>
                    <td className="px-4 py-2 font-medium">{entrant.name}</td>
                    <td className="px-4 py-2" style={{ color: "var(--win)" }}>
                      {record?.wins ?? 0}
                    </td>
                    <td className="px-4 py-2" style={{ color: "var(--lose)" }}>
                      {record?.losses ?? 0}
                    </td>
                    <td className="px-4 py-2">
                      {history.length === 0 ? (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {history.map((h, i) => (
                            <li
                              key={i}
                              className="text-xs flex items-center gap-1.5"
                              style={{ color: "var(--muted)" }}
                            >
                              {h.tournamentLogoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={h.tournamentLogoUrl}
                                  alt=""
                                  className="w-4 h-4 rounded-sm object-cover shrink-0"
                                />
                              ) : (
                                <span className="w-4 h-4 shrink-0" />
                              )}
                              <span style={{ color: "var(--foreground)" }}>
                                {h.tournamentName || h.eventName}
                              </span>
                              {" — "}
                              {h.placement != null ? `${h.placement}e` : "?"}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {topStandings.length === 0 && (
            <p className="p-4 text-sm" style={{ color: "var(--muted)" }}>
              Aucun joueur dans le top {TOP_CUTOFF} pour le moment.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
