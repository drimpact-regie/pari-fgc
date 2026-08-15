"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Character {
  id: string;
  name: string;
  imageUrl: string | null;
}

/** Couleur déterministe (pas d'aléatoire) dérivée du nom, pour l'avatar de repli sans image. */
function fallbackColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(hash) % 360}, 55%, 32%)`;
}

function CharacterAvatar({ character, size = 48 }: { character: Character; size?: number }) {
  if (character.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={character.imageUrl}
        alt=""
        className="rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-md flex items-center justify-center font-bold text-white"
      style={{ width: size, height: size, background: fallbackColor(character.name) }}
    >
      {character.name.charAt(0).toUpperCase()}
    </div>
  );
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

  const visibleCharacters = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter((c) => c.name.toLowerCase().includes(q));
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
              {initialCharacter && <CharacterAvatar character={initialCharacter} size={28} />}
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {selected ? (
            <div
              className="flex items-center gap-3 p-2 rounded-md"
              style={{ background: "var(--surface-alt)" }}
            >
              <CharacterAvatar character={selected} size={40} />
              <span className="text-sm font-medium flex-1">{selected.name}</span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs"
                style={{ color: "var(--lose)" }}
              >
                Changer
              </button>
            </div>
          ) : (
            <>
              {characters.length > 8 && (
                <input
                  className="input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filtrer les personnages..."
                />
              )}
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))" }}
              >
                {visibleCharacters.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelected(c)}
                    className="flex flex-col items-center gap-1 p-2 rounded-md hover:opacity-80 text-center"
                    style={{ background: "var(--surface-alt)" }}
                  >
                    <CharacterAvatar character={c} />
                    <span className="text-xs leading-tight">{c.name}</span>
                  </button>
                ))}
                {visibleCharacters.length === 0 && (
                  <p className="text-sm col-span-full" style={{ color: "var(--muted)" }}>
                    Aucun personnage ne correspond.
                  </p>
                )}
              </div>
            </>
          )}

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
