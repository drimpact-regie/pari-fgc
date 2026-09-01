"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PreviewEvent {
  id: string;
  name: string;
  eventSlug: string;
  videogameName: string | null;
  numEntrants: number | null;
  alreadyImported: boolean;
}

/**
 * Import groupé de tous les jeux d'un tournoi start.gg multi-jeux (ex : un
 * tournoi à 15 jeux, dont on ne veut peut-être pas tous les suivre) —
 * évite de répéter le formulaire d'ajout simple event par event. Deux
 * étapes : lister (lecture seule côté start.gg), puis choisir/renommer
 * avant de créer les Tournament sélectionnés.
 */
export default function BulkImportTournamentsForm() {
  const router = useRouter();
  const [tournamentSlug, setTournamentSlug] = useState("");
  const [tournamentName, setTournamentName] = useState<string | null>(null);
  const [events, setEvents] = useState<PreviewEvent[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: string[]; skipped: string[] } | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    const res = await fetch("/api/admin/tournaments/bulk-import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentSlug }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur lors de la recherche.");
      setEvents([]);
      setTournamentName(null);
      return;
    }

    const fetchedEvents: PreviewEvent[] = data.events;
    const nextSelected: Record<string, boolean> = {};
    const nextNames: Record<string, string> = {};
    for (const event of fetchedEvents) {
      nextSelected[event.eventSlug] = !event.alreadyImported;
      nextNames[event.eventSlug] = event.name;
    }

    setTournamentName(data.tournamentName);
    setEvents(fetchedEvents);
    setSelected(nextSelected);
    setNames(nextNames);
  }

  async function handleImport() {
    setError(null);
    setLoading(true);

    const toImport = events
      .filter((event) => selected[event.eventSlug])
      .map((event) => ({
        eventSlug: event.eventSlug,
        name: names[event.eventSlug]?.trim() || event.name,
      }));

    const res = await fetch("/api/admin/tournaments/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: toImport }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'import.");
      return;
    }

    setResult(data);
    setEvents([]);
    setTournamentName(null);
    setTournamentSlug("");
    router.refresh();
  }

  const selectedCount = events.filter((event) => selected[event.eventSlug]).length;

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold">Importer tous les jeux d&apos;un tournoi</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Pour un tournoi multi-jeux (plusieurs jeux au sein du même tournoi start.gg) — colle le
          lien du tournoi (pas d&apos;un jeu précis) pour lister tous ses jeux, choisir lesquels
          suivre et les ajouter d&apos;un coup.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex items-end gap-2">
        <label className="text-sm flex-1">
          Lien ou slug start.gg du tournoi
          <input
            className="input mt-1"
            value={tournamentSlug}
            onChange={(e) => setTournamentSlug(e.target.value)}
            placeholder="https://www.start.gg/tournament/xxx/details"
            required
          />
        </label>
        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Recherche..." : "Voir les jeux"}
        </button>
      </form>

      {error && (
        <p className="text-sm" style={{ color: "var(--lose)" }}>
          {error}
        </p>
      )}

      {result && (
        <p className="text-sm" style={{ color: "var(--win)" }}>
          {result.created.length} jeu{result.created.length > 1 ? "x" : ""} importé
          {result.created.length > 1 ? "s" : ""}
          {result.skipped.length > 0
            ? ` — ${result.skipped.length} déjà existant${result.skipped.length > 1 ? "s" : ""} ignoré${result.skipped.length > 1 ? "s" : ""}.`
            : "."}
        </p>
      )}

      {events.length > 0 && (
        <div className="flex flex-col gap-3">
          {tournamentName && <p className="text-sm font-semibold">{tournamentName}</p>}
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
            {events.map((event) => (
              <div key={event.eventSlug} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(selected[event.eventSlug])}
                  disabled={event.alreadyImported}
                  onChange={(e) =>
                    setSelected((prev) => ({ ...prev, [event.eventSlug]: e.target.checked }))
                  }
                />
                <input
                  className="input flex-1"
                  value={names[event.eventSlug] ?? event.name}
                  disabled={event.alreadyImported}
                  onChange={(e) => setNames((prev) => ({ ...prev, [event.eventSlug]: e.target.value }))}
                />
                <span className="text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>
                  {event.videogameName ?? "?"}
                  {event.numEntrants != null ? ` · ${event.numEntrants} entrants` : ""}
                </span>
                {event.alreadyImported && (
                  <span className="text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    déjà importé
                  </span>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary self-start"
            disabled={loading || selectedCount === 0}
            onClick={handleImport}
          >
            {loading ? "Import..." : `Importer ${selectedCount} jeu${selectedCount > 1 ? "x" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
