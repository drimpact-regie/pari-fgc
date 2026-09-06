"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteTournamentButton({
  tournamentId,
  tournamentName,
}: {
  tournamentId: string;
  tournamentName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const confirmed = window.confirm(
      `Supprimer "${tournamentName}" ? Les paris déjà placés restent en base mais ne seront plus accessibles via les pages de ce tournoi.`,
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/tournaments/${tournamentId}`, {
      method: "DELETE",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "Erreur.");
      return;
    }

    // Après suppression, cette page (propre à CE tournoi, voir la page
    // régie) n'a plus de sens — un simple router.refresh() y déclencherait
    // un 404 sec plutôt que de ramener vers la liste.
    router.push("/admin/tournaments");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-xs underline"
        style={{ color: "var(--lose)" }}
      >
        {loading ? "..." : "Supprimer"}
      </button>
      {error && (
        <span className="text-xs text-right" style={{ color: "var(--lose)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
