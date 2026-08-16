"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { computeMatchBetPayout } from "@/lib/odds";

interface Competitor {
  id: string;
  name: string;
  tag: string | null;
  countryCode: string | null;
  /** Cote décimale courante, calculée depuis la série de victoires en cours (lib/invitationalOdds.ts). */
  odds: number;
}

interface ExistingBet {
  competitorName: string;
  stake: number;
  odds: number;
  status: "PENDING" | "WON" | "LOST" | "CANCELLED";
  payout: number;
}

interface Props {
  matchId: string;
  competitorA: Competitor | null;
  competitorB: Competitor | null;
  /** true si le match n'est pas au statut OPEN (paris fermés côté site). */
  locked: boolean;
  exBalance: number;
  existingBet: ExistingBet | null;
}

const STATUS_LABEL: Record<ExistingBet["status"], string> = {
  PENDING: "en attente",
  WON: "gagné",
  LOST: "perdu",
  CANCELLED: "annulé",
};

function competitorLabel(c: Competitor): string {
  return c.tag ? `${c.tag} | ${c.name}` : c.name;
}

export default function InvitationalBetCard({
  matchId,
  competitorA,
  competitorB,
  locked,
  exBalance,
  existingBet,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [stake, setStake] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const competitors = [competitorA, competitorB].filter((c): c is Competitor => c !== null);
  const disabled = locked || existingBet !== null || competitors.length !== 2;

  const stakeNum = Number(stake);
  const stakeValid = stake.trim() !== "" && Number.isInteger(stakeNum) && stakeNum > 0;
  const selectedCompetitor = competitors.find((c) => c.id === selected) ?? null;
  const exceedsBalance = stakeValid && stakeNum > exBalance;
  const potentialPayout =
    selectedCompetitor && stakeValid
      ? computeMatchBetPayout({ won: true, stake: stakeNum, odds: selectedCompetitor.odds })
      : null;

  function selectCompetitor(id: string) {
    setSelected(id);
    setError(null);
  }

  async function placeBet() {
    if (!selected || !stakeValid) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/invitational/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, competitorId: selected, stake: stakeNum }),
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
              Pari placé : {existingBet.competitorName} — {existingBet.stake} Ex à{" "}
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

      {competitors.length !== 2 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          En attente de la désignation des deux compétiteurs.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {competitors.map((competitor) => (
            <label
              key={competitor.id}
              className="flex items-center justify-between gap-2 text-sm px-3 py-2 rounded-md"
              style={{
                background: "var(--surface-alt)",
                opacity: disabled && selected !== competitor.id ? 0.6 : 1,
              }}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`match-${matchId}`}
                  value={competitor.id}
                  disabled={disabled}
                  checked={selected === competitor.id}
                  onChange={() => selectCompetitor(competitor.id)}
                />
                {competitor.countryCode && (
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    [{competitor.countryCode}]
                  </span>
                )}
                {competitorLabel(competitor)}
              </span>
              <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                {competitor.odds.toFixed(2)}
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
