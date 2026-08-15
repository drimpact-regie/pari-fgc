"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TwitchSubscribeButton({
  tournamentId,
  active,
}: {
  tournamentId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/tournaments/${tournamentId}/twitch-subscribe`, {
      method: "POST",
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
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
        style={{ color: active ? "var(--win)" : "var(--accent)" }}
      >
        {loading ? "..." : active ? "Chat actif — réactiver" : "Activer le chat betting"}
      </button>
      {error && (
        <span className="text-xs text-right" style={{ color: "var(--lose)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
