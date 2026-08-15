"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Entrant {
  id: string;
  name: string;
}

export type PickStatus = "correct" | "wrong" | "pending";

const STATUS_ICON: Record<PickStatus, string> = {
  correct: "🟩",
  wrong: "🟥",
  pending: "⬜",
};

export default function Top8PickForm({
  tournamentId,
  entrants,
  initialPicks,
  locked,
  statusByEntrantId,
}: {
  tournamentId: string;
  entrants: Entrant[];
  initialPicks: Entrant[];
  locked: boolean;
  statusByEntrantId: Record<string, PickStatus>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Entrant[]>(initialPicks);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const selectedIds = new Set(selected.map((e) => e.id));
    return entrants
      .filter((e) => !selectedIds.has(e.id) && e.name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [query, entrants, selected]);

  function addEntrant(entrant: Entrant) {
    if (selected.length >= 8) return;
    setSelected((prev) => [...prev, entrant]);
    setQuery("");
  }

  function removeEntrant(id: string) {
    setSelected((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/top8", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId, entrantIds: selected.map((e) => e.id) }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de l'enregistrement.");
      return;
    }

    router.refresh();
  }

  if (locked) {
    return (
      <div className="card p-4 flex flex-col gap-2">
        <p className="text-sm font-semibold">Vos pronostics (verrouillés)</p>
        <div className="flex flex-wrap gap-2">
          {selected.length === 0 && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Vous n&apos;avez pas fait de pronostic pour ce tournoi.
            </p>
          )}
          {selected.map((e) => (
            <span
              key={e.id}
              className="text-sm px-3 py-1 rounded-md flex items-center gap-1.5"
              style={{ background: "var(--surface-alt)" }}
            >
              {STATUS_ICON[statusByEntrantId[e.id] ?? "pending"]} {e.name}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold">
        Vos pronostics Top 8 ({selected.length}/8)
      </p>

      <div className="flex flex-wrap gap-2">
        {selected.map((e) => (
          <span
            key={e.id}
            className="text-sm px-3 py-1 rounded-md flex items-center gap-2"
            style={{ background: "var(--surface-alt)" }}
          >
            {STATUS_ICON[statusByEntrantId[e.id] ?? "pending"]} {e.name}
            <button
              type="button"
              onClick={() => removeEntrant(e.id)}
              aria-label={`Retirer ${e.name}`}
              style={{ color: "var(--lose)" }}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {selected.length < 8 && (
        <div className="relative">
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un joueur..."
          />
          {results.length > 0 && (
            <div
              className="absolute z-10 mt-1 w-full rounded-md overflow-hidden max-h-60 overflow-y-auto"
              style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
            >
              {results.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => addEntrant(e)}
                  className="w-full text-left px-3 py-2 text-sm hover:opacity-80"
                >
                  {e.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: "var(--lose)" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn btn-primary self-start"
        disabled={selected.length === 0 || saving}
        onClick={handleSave}
      >
        {saving ? "Enregistrement..." : "Enregistrer mes pronostics"}
      </button>
    </div>
  );
}
