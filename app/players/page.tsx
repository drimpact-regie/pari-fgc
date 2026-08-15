import {
  computeRecords,
  getCompletedSets,
  getStandings,
  StartggApiError,
} from "@/lib/startgg";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  let standings: Awaited<ReturnType<typeof getStandings>> = [];
  let records: ReturnType<typeof computeRecords> = new Map();
  let error: string | null = null;

  try {
    const [standingsResult, completedSets] = await Promise.all([
      getStandings(),
      getCompletedSets(),
    ]);
    standings = standingsResult;
    records = computeRecords(completedSets);
  } catch (err) {
    error = err instanceof StartggApiError ? err.message : "Erreur inconnue.";
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Joueurs</h1>

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
              </tr>
            </thead>
            <tbody>
              {standings
                .filter((s) => s.entrant !== null)
                .map((standing) => {
                  const record = records.get(standing.entrant!.id);
                  return (
                    <tr key={standing.entrant!.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-4 py-2">{standing.placement ?? "—"}</td>
                      <td className="px-4 py-2 font-medium">{standing.entrant!.name}</td>
                      <td className="px-4 py-2" style={{ color: "var(--win)" }}>
                        {record?.wins ?? 0}
                      </td>
                      <td className="px-4 py-2" style={{ color: "var(--lose)" }}>
                        {record?.losses ?? 0}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {standings.length === 0 && (
            <p className="p-4 text-sm" style={{ color: "var(--muted)" }}>
              Aucun classement disponible pour le moment.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
