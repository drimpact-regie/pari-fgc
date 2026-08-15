"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Entrant {
  id: string;
  name: string;
  seedNum: number | null;
}

interface Props {
  tournamentId: string;
  setId: string;
  entrants: Entrant[];
  totalGames: number | null;
  locked: boolean;
  existingBetEntrantName: string | null;
  existingBetEntrantScore: number | null;
  existingBetOpponentScore: number | null;
}

export default function BetCard({
  tournamentId,
  setId,
  entrants,
  totalGames,
  locked,
  existingBetEntrantName,
  existingBetEntrantScore,
  existingBetOpponentScore,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedScore, setSelectedScore] = useState<{ w: number; l: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyBet = existingBetEntrantName !== null;
  const disabled = locked || alreadyBet || entrants.length !== 2;

  // Manches nécessaires pour gagner ce set (2 en Bo3, 3 en Bo5, ...).
  const majority = totalGames ? Math.ceil(totalGames / 2) : null;
  const scoreOptions = majority
    ? Array.from({ length: majority }, (_, loserGames) => ({ w: majority, l: loserGames }))
    : [];

  function selectEntrant(id: string) {
    setSelected(id);
    setSelectedScore(null);
  }

  async function placeBet() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentId,
        setId,
        entrantId: selected,
        ...(selectedScore
          ? { predictedEntrantScore: selectedScore.w, predictedOpponentScore: selectedScore.l }
          : {}),
      }),
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
      {(alreadyBet || (locked && !alreadyBet)) && (
        <div className="flex items-center justify-end">
          {alreadyBet && (
            <span className="text-xs" style={{ color: "var(--accent)" }}>
              Pari placé : {existingBetEntrantName}
              {existingBetEntrantScore != null && existingBetOpponentScore != null
                ? ` (${existingBetEntrantScore}-${existingBetOpponentScore})`
                : ""}
            </span>
          )}
          {locked && !alreadyBet && (
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              Paris fermés
            </span>
          )}
        </div>
      )}

      {entrants.length !== 2 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          En attente de qualification d&apos;un des joueurs.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {entrants.map((entrant, i) => {
            const other = entrants[1 - i];
            const isUnderdog =
              entrant.seedNum != null && other.seedNum != null && entrant.seedNum > other.seedNum;

            return (
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
                  onChange={() => selectEntrant(entrant.id)}
                />
                {entrant.name}
                {isUnderdog && (
                  <span className="text-xs" style={{ color: "var(--accent)" }}>
                    outsider · bonus points
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}

      {!disabled && selected && scoreOptions.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Score exact (optionnel, bonus de points) :
          </span>
          <div className="flex gap-2 flex-wrap">
            {scoreOptions.map((opt) => {
              const active = selectedScore?.w === opt.w && selectedScore?.l === opt.l;
              return (
                <button
                  key={`${opt.w}-${opt.l}`}
                  type="button"
                  onClick={() => setSelectedScore(active ? null : opt)}
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    background: active ? "var(--accent)" : "var(--surface-alt)",
                    color: active ? "#0b0d12" : "var(--muted)",
                  }}
                >
                  {opt.w}-{opt.l}
                </button>
              );
            })}
          </div>
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
