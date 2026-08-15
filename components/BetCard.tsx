"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Entrant {
  id: string;
  name: string;
}

interface Props {
  setId: string;
  roundText: string;
  entrants: Entrant[];
  locked: boolean;
  existingBetEntrantName: string | null;
}

export default function BetCard({
  setId,
  roundText,
  entrants,
  locked,
  existingBetEntrantName,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyBet = existingBetEntrantName !== null;
  const disabled = locked || alreadyBet || entrants.length !== 2;

  async function placeBet() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId, entrantId: selected }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors du pari.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{roundText}</span>
        {alreadyBet && (
          <span className="text-xs" style={{ color: "var(--accent)" }}>
            Pari placé : {existingBetEntrantName}
          </span>
        )}
        {locked && !alreadyBet && (
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Paris fermés
          </span>
        )}
      </div>

      {entrants.length !== 2 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          En attente de qualification d&apos;un des joueurs.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {entrants.map((entrant) => (
            <label
              key={entrant.id}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-md"
              style={{
                background: "var(--surface-alt)",
                opacity: disabled && selected !== entrant.id ? 0.6 : 1,
              }}
            >
              <input
                type="radio"
                name={`set-${setId}`}
                value={entrant.id}
                disabled={disabled}
                checked={selected === entrant.id}
                onChange={() => setSelected(entrant.id)}
              />
              {entrant.name}
            </label>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: "var(--lose)" }}>
          {error}
        </p>
      )}

      {!disabled && (
        <button
          type="button"
          className="btn btn-primary self-start"
          disabled={!selected || submitting}
          onClick={placeBet}
        >
          {submitting ? "Envoi..." : "Parier"}
        </button>
      )}
    </div>
  );
}
