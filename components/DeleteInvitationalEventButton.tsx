"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteInvitationalEventButton({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const confirmed = window.confirm(
      `Supprimer "${eventName}" ? Compétiteurs, matchs et paris liés à cet event seront définitivement supprimés.`,
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/invitational/events/${eventId}`, {
      method: "DELETE",
    });

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
