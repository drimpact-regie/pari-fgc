import { notFound } from "next/navigation";

import { getTournament } from "@/lib/tournaments";
import { getEventEntrants, StartggApiError } from "@/lib/startgg";

export const dynamic = "force-dynamic";

/**
 * "Les Beaters" : liste complète des joueurs inscrits sur ce tournoi (tous,
 * peu importe leur avancement) — distinct de l'onglet "Joueurs" qui montre
 * le classement/palmarès des joueurs encore en course ou dans le top 16
 * (voir players/page.tsx), pas la liste brute des inscrits.
 */
export default async function BeatersPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const tournament = await getTournament(tournamentId);
  if (!tournament) notFound();

  let entrants: Awaited<ReturnType<typeof getEventEntrants>> = [];
  let error: string | null = null;
  try {
    entrants = await getEventEntrants(tournament.eventSlug);
  } catch (err) {
    error = err instanceof StartggApiError ? err.message : "Erreur inconnue.";
  }

  const sorted = [...entrants].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="card p-4" style={{ color: "var(--lose)" }}>
          Impossible de récupérer les inscrits depuis start.gg : {error}
        </div>
      )}

      {!error && (
        <div className="card p-4">
          <p className="text-sm font-semibold mb-3">
            {sorted.length} joueur{sorted.length > 1 ? "s" : ""} inscrit{sorted.length > 1 ? "s" : ""}
          </p>
          {sorted.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Aucun inscrit pour le moment.
            </p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {sorted.map((entrant) => (
                <li
                  key={entrant.id}
                  className="text-sm px-3 py-2 rounded-md"
                  style={{ background: "var(--surface-alt)" }}
                >
                  {entrant.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
