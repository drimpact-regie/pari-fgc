"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { computeMatchBetPayout } from "@/lib/odds";

interface Entrant {
  id: string;
  name: string;
  seedNum: number | null;
  /** Cote décimale de cet entrant, calculée depuis les seeds (lib/odds.ts). */
  odds: number;
}

interface ExistingBet {
  entrantName: string;
  stake: number;
  odds: number;
  status: "PENDING" | "WON" | "LOST";
  /** Gain total crédité si status === "WON" (0 sinon). */
  payout: number;
}

interface Props {
  tournamentId: string;
  setId: string;
  entrants: Entrant[];
  locked: boolean;
  /** Solde Ex courant de l'utilisateur, pour valider la mise côté client. */
  exBalance: number;
  existingBet: ExistingBet | null;
}

const STATUS_LABEL: Record<ExistingBet["status"], string> = {
  PENDING: "en attente",
  WON: "gagné",
  LOST: "perdu",
};

export default function BetCard({
  tournamentId,
  setId,
  entrants,
  locked,
  exBalance,
  existingBet,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [stake, setStake] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = locked || existingBet !== null || entrants.length !== 2;

  const stakeNum = Number(stake);
  const stakeValid = stake.trim() !== "" && Number.isInteger(stakeNum) && stakeNum > 0;
  const selectedEntrant = entrants.find((e) => e.id === selected) ?? null;
  const exceedsBalance = stakeValid && stakeNum > exBalance;
  const potentialPayout =
    selectedEntrant && stakeValid
      ? computeMatchBetPayout({ won: true, stake: stakeNum, odds: selectedEntrant.odds })
      : null;

  function selectEntrant(id: string) {
    setSelected(id);
    setError(null);
  }

  async function placeBet() {
    if (!selected || !stakeValid) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId, setId, entrantId: selected, stake: stakeNum }),
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
      {(existingBet || (locked && !existingBet)) && (
        <div className="flex items-center justify-end">
          {existingBet && (
            <span className="text-xs text-right" style={{ color: "var(--gold)" }}>
              Pari placé : {existingBet.entrantName} — {existingBet.stake} Ex à{" "}
              {existingBet.odds.toFixed(2)}
              {existingBet.status === "PENDING" && (
                <> · gain potentiel {Math.round(existingBet.stake * existingBet.odds)} Ex</>
              )}
              {existingBet.status !== "PENDING" && (
                <>
                  {" "}
                  · {STATUS_LABEL[existingBet.status]}
                  {existingBet.status === "WON" ? ` (+${existingBet.payout} Ex)` : ""}
                </>
              )}
            </span>
          )}
          {locked && !existingBet && (
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
          {entrants.map((entrant) => (
            <label
              key={entrant.id}
              className="flex items-center justify-between gap-2 text-sm px-3 py-2 rounded-md"
              style={{
                background: "var(--surface-alt)",
                opacity: disabled && selected !== entrant.id ? 0.6 : 1,
              }}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`set-${setId}`}
                  value={entrant.id}
                  disabled={disabled}
                  checked={selected === entrant.id}
                  onChange={() => selectEntrant(entrant.id)}
                />
                {entrant.name}
              </span>
              <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                {entrant.odds.toFixed(2)}
              </span>
            </label>
          ))}
        </div>
      )}

      {!disabled && selected && (
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--muted)" }}>
            Mise (
            <span style={{ color: "var(--gold)" }}>{exBalance} Ex</span> disponibles)
          </label>
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            className="input"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            placeholder="0"
          />
          {exceedsBalance && (
            <span className="text-xs" style={{ color: "var(--lose)" }}>
              Solde Ex insuffisant.
            </span>
          )}
          {potentialPayout !== null && !exceedsBalance && (
            <span className="text-xs" style={{ color: "var(--win)" }}>
              Gain potentiel : <span style={{ color: "var(--gold)" }}>{potentialPayout} Ex</span>
            </span>
          )}
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
          disabled={!selected || !stakeValid || exceedsBalance || submitting}
          onClick={placeBet}
        >
          {submitting ? "Envoi..." : "Parier"}
        </button>
      )}
    </div>
  );
}
