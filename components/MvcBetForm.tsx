"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Character {
  id: string;
  name: string;
  imageUrl: string | null;
}

export default function MvcBetForm({
  tournamentId,
  characters,
  locked,
  initialCharacter,
  initialPredictedCount,
  actualCount,
}: {
  tournamentId: string;
  characters: Character[];
  locked: boolean;
  initialCharacter: Character | null;
  initialPredictedCount: number | null;
  actualCount: number | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Character | null>(initialCharacter);
  const [count, setCount] = useState(initialPredictedCount ?? 0);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyBet = initialCharacter !== null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return characters.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 20);
  }, [query, characters]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/sidebets/mvc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId, characterId: selected.id, predictedCount: count }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors du pari.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold">MVC — Most Valuable Character</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Combien de fois ce personnage apparaîtra-t-il dans le top 8 ? Se verrouille une
          étape avant le top 8.
        </p>
      </div>

      {locked || alreadyBet ? (
        <p className="text-sm flex items-center gap-2">
          {alreadyBet ? (
            <>
              {initialCharacter?.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={initialCharacter.imageUrl}
                  alt=""
                  className="w-6 h-6 rounded-sm object-cover"
                />
              )}
              Pari placé : <span className="font-medium">{initialCharacter?.name}</span> ×{" "}
              {initialPredictedCount}
              {actualCount != null && (
                <span style={{ color: "var(--muted)" }}> (réel : {actualCount})</span>
              )}
            </>
          ) : (
            <span style={{ color: "var(--muted)" }}>Paris MVC fermés.</span>
          )}
        </p>
      ) : characters.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Aucun personnage disponible pour ce jeu pour le moment — contacte un admin.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="relative">
            <input
              className="input"
              value={selected ? selected.name : query}
              onChange={(e) => {
                setSelected(null);
                setQuery(e.target.value);
              }}
              placeholder="Rechercher un personnage..."
              required
            />
            {results.length > 0 && !selected && (
              <div
                className="absolute z-10 mt-1 w-full rounded-md overflow-hidden max-h-60 overflow-y-auto"
                style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
              >
                {results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelected(c);
                      setQuery("");
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:opacity-80 flex items-center gap-2"
                  >
                    {c.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" className="w-5 h-5 rounded-sm object-cover" />
                    )}
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm">
              Apparitions (0-8)
              <input
                type="number"
                min={0}
                max={8}
                className="input mt-1"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary self-end" disabled={!selected || saving}>
              {saving ? "Envoi..." : "Parier"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="text-sm" style={{ color: "var(--lose)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
