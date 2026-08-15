"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BracketResetBetForm({
  tournamentId,
  locked,
  initialPrediction,
  actualYes,
}: {
  tournamentId: string;
  locked: boolean;
  initialPrediction: boolean | null;
  actualYes: boolean | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyBet = initialPrediction !== null;

  async function place(predictedYes: boolean) {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/sidebets/bracket-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId, predictedYes }),
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
        <p className="text-sm font-semibold">Reset de bracket en grande finale ?</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Le joueur venant du loser bracket gagne-t-il le 1er set, forçant un 2e set ?
        </p>
      </div>

      {locked || alreadyBet ? (
        <p className="text-sm">
          {alreadyBet ? (
            <>
              Pari placé : <span className="font-medium">{initialPrediction ? "Oui" : "Non"}</span>
              {actualYes != null && (
                <span style={{ color: "var(--muted)" }}>
                  {" "}
                  (réel : {actualYes ? "Oui" : "Non"})
                </span>
              )}
            </>
          ) : (
            <span style={{ color: "var(--muted)" }}>Pari reset de bracket fermé.</span>
          )}
        </p>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={() => place(true)}
          >
            Oui
          </button>
          <button
            type="button"
            className="btn"
            style={{ background: "var(--surface-alt)" }}
            disabled={saving}
            onClick={() => place(false)}
          >
            Non
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: "var(--lose)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
