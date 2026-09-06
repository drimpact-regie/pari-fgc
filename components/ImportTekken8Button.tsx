"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportTekken8Button() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function importRoster() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/characters/import-tekken8", { method: "POST" });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de l'import.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="card p-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">Roster TEKKEN 8</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Importe les 42 personnages sortis à ce jour (base + DLC saisons 1-3). Sans image pour
          l&apos;instant — à compléter ensuite ci-dessous, une fois le roster créé.
        </p>
        {error && (
          <p className="text-xs mt-1" style={{ color: "var(--lose)" }}>
            {error}
          </p>
        )}
      </div>
      <button type="button" className="btn btn-primary" onClick={importRoster} disabled={loading}>
        {loading ? "..." : "Importer"}
      </button>
    </div>
  );
}
