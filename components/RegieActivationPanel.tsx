"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ResyncSummary {
  created: number;
  updated: number;
  skippedLocked: number;
}

/**
 * Active/resynchronise le "mode régie" d'un tournoi start.gg (voir
 * lib/tournamentRegie.ts) — un seul appel API à l'activation (pas de
 * polling), une resync manuelle ensuite quand le régisseur le décide.
 */
export default function RegieActivationPanel({
  tournamentId,
  active,
}: {
  tournamentId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ResyncSummary | null>(null);

  async function run(action: "activate" | "resync") {
    setLoading(true);
    setError(null);
    setSummary(null);

    const res = await fetch(`/api/admin/tournaments/${tournamentId}/regie/${action}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));

    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur.");
      return;
    }

    if (data.summary) setSummary(data.summary);
    router.refresh();
  }

  if (!active) {
    return (
      <div className="card p-4 flex flex-col gap-2">
        <div>
          <p className="text-sm font-semibold">Mode régie</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Importe en un seul appel le bracket et les joueurs de ce tournoi depuis start.gg, pour
            gérer les scores en direct, désigner le match affiché en overlay OBS et afficher un
            arbre de bracket visuel — comme pour un event Invitational/Prestataire. N&apos;affecte pas
            les onglets Matchs/Joueurs/Top 8/LeaderBet/Le Pari du Parry ni l&apos;économie de paris,
            qui restent branchés sur start.gg en direct comme aujourd&apos;hui.
          </p>
        </div>
        <div>
          <button type="button" className="btn btn-primary text-xs" disabled={loading} onClick={() => run("activate")}>
            {loading ? "..." : "Activer le mode régie"}
          </button>
        </div>
        {error && (
          <p className="text-xs" style={{ color: "var(--lose)" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Mode régie actif</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Resynchronise la structure (joueurs, DQ) depuis start.gg — un match déjà en cours ou
            joué n&apos;est jamais écrasé.
          </p>
        </div>
        <button type="button" className="btn text-xs" disabled={loading} onClick={() => run("resync")}>
          {loading ? "..." : "Resynchroniser depuis start.gg"}
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
