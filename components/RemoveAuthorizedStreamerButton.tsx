"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RemoveAuthorizedStreamerButton({
  streamerId,
  displayName,
}: {
  streamerId: string;
  displayName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const confirmed = window.confirm(`Retirer l'autorisation de "${displayName}" ?`);
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/streamers/${streamerId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "Erreur.");
      return;
    }

    router.refresh();
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
        {loading ? "..." : "Retirer"}
      </button>
      {error && (
        <span className="text-xs text-right" style={{ color: "var(--lose)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
