"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SyncResult {
  resolvedSets: number;
  resolvedBets: number;
  errors: string[];
}

export default function SyncResultsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/admin/sync-results", { method: "POST" });
    const data = await res.json().catch(() => ({}));

    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur lors de la synchronisation.");
      return;
    }

    setResult(data);
    router.refresh();
  }

  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Résoudre les paris</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Interroge start.gg pour les matchs pariés terminés (tous tournois) et attribue les
            Ex.
          </p>
        </div>
        <button type="button" className="btn btn-primary text-xs" disabled={loading} onClick={handleClick}>
          {loading ? "..." : "Résoudre les paris"}
        </button>
      </div>

      {result && (
        <p className="text-xs" style={{ color: "var(--win)" }}>
          {result.resolvedSets} match{result.resolvedSets > 1 ? "s" : ""} résolu
          {result.resolvedSets > 1 ? "s" : ""}, {result.resolvedBets} pari
          {result.resolvedBets > 1 ? "s" : ""} mis à jour.
          {result.errors.length > 0 && ` ${result.errors.length} erreur(s).`}
        </p>
      )}
      {result?.errors && result.errors.length > 0 && (
        <ul className="text-xs" style={{ color: "var(--lose)" }}>
          {result.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {error && (
        <p className="text-xs" style={{ color: "var(--lose)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
