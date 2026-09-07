"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Rafraîchir depuis start.gg" pour CE tournoi — invalide le cache
 * start.gg côté serveur (invalidateStartggCache) puis relance le rendu de
 * la page, plutôt que d'attendre la fin de la fenêtre de cache
 * (STARTGG_CACHE_SECONDS) ou de recharger la page en boucle en espérant
 * qu'elle se rafraîchisse — utile juste après le lancement du bracket
 * côté start.gg, ou après une correction de seed/DQ.
 */
export default function RefreshStartggButton({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/tournaments/${tournamentId}/refresh`, { method: "POST" });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn text-xs" disabled={loading} onClick={refresh}>
        {loading ? "..." : "Rafraîchir depuis start.gg"}
      </button>
      {error && (
        <span className="text-xs" style={{ color: "var(--lose)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
