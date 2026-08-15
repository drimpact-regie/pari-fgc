"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MvcBetForm({
  tournamentId,
  locked,
  initialCharacter,
  initialPredictedCount,
  actualCount,
}: {
  tournamentId: string;
  locked: boolean;
  initialCharacter: string | null;
  initialPredictedCount: number | null;
  actualCount: number | null;
}) {
  const router = useRouter();
  const [character, setCharacter] = useState(initialCharacter ?? "");
  const [count, setCount] = useState(initialPredictedCount ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyBet = initialCharacter !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/sidebets/mvc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId, character, predictedCount: count }),
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
          Combien de fois ce personnage apparaîtra-t-il dans le top 8 ?
        </p>
      </div>

      {locked || alreadyBet ? (
        <p className="text-sm">
          {alreadyBet ? (
            <>
              Pari placé : <span className="font-medium">{initialCharacter}</span> ×{" "}
              {initialPredictedCount}
              {actualCount != null && (
                <span style={{ color: "var(--muted)" }}> (réel : {actualCount})</span>
              )}
            </>
          ) : (
            <span style={{ color: "var(--muted)" }}>Paris MVC fermés.</span>
          )}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-sm flex-1">
            Personnage
            <input
              className="input mt-1"
              value={character}
              onChange={(e) => setCharacter(e.target.value)}
              placeholder="Ex : Ryu"
              required
            />
          </label>
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
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Envoi..." : "Parier"}
          </button>
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
