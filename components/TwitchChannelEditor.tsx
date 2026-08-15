"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TwitchChannelEditor({
  tournamentId,
  initialChannel,
}: {
  tournamentId: string;
  initialChannel: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialChannel ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/tournaments/${tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twitchChannel: value }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur.");
      return;
    }

    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs underline"
        style={{ color: initialChannel ? "var(--accent)" : "var(--muted)" }}
      >
        {initialChannel ?? "Ajouter une chaîne Twitch"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="input"
        style={{ width: "10rem", padding: "0.25rem 0.5rem" }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="mk_rza ou lien twitch.tv/..."
        autoFocus
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={loading}
        className="text-xs font-semibold"
        style={{ color: "var(--accent)" }}
      >
        {loading ? "..." : "OK"}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setValue(initialChannel ?? "");
          setError(null);
        }}
        className="text-xs"
        style={{ color: "var(--muted)" }}
      >
        Annuler
      </button>
      {error && (
        <span className="text-xs" style={{ color: "var(--lose)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
