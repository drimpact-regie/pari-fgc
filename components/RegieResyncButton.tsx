"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ResyncSummary {
  created: number;
  updated: number;
  skippedLocked: number;
}

/**
 * Version compacte de RegieActivationPanel (uniquement la resync, pas
 * l'activation) — pour l'accès direct depuis la page de l'event
 * Invitational/mode régie (onglet Matchs) elle-même, plutôt que de forcer
 * l'admin à revenir sur la page de régie du tournoi (/admin/tournaments/[id]/regie)
 * à chaque fois qu'il veut resynchroniser en cours de tournoi.
 */
export default function RegieResyncButton({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ResyncSummary | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setSummary(null);

    const res = await fetch(`/api/admin/tournaments/${tournamentId}/regie/resync`, { method: "POST" });
    const data = await res.json().catch(() => ({}));

    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur.");
      return;
    }

    setSummary(data.summary ?? null);
    router.refresh();
  }

  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Mode régie</p>
        <button type="button" className="btn text-xs" disabled={loading} onClick={run}>
          {loading ? "..." : error ? "Réessayer" : "Resynchroniser depuis start.gg"}
        </button>
      </div>
      {summary && (
        <p className="text-xs" style={{ color: "var(--win)" }}>
          {summary.created} match{summary.created > 1 ? "s" : ""} ajouté{summary.created > 1 ? "s" : ""},{" "}
          {summary.updated} mis à jour, {summary.skippedLocked} déjà en cours/joué
          {summary.skippedLocked > 1 ? "s" : ""} (ignoré{summary.skippedLocked > 1 ? "s" : ""}).
        </p>
      )}
      {error && (
        <p className="text-xs" style={{ color: "var(--lose)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
