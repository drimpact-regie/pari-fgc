"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddAuthorizedStreamerForm() {
  const router = useRouter();
  const [twitchChannel, setTwitchChannel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/admin/streamers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twitchChannel }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'autorisation.");
      return;
    }

    setTwitchChannel("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 flex flex-col gap-3">
      <label className="text-sm">
        Chaîne Twitch
        <input
          className="input mt-1"
          value={twitchChannel}
          onChange={(e) => setTwitchChannel(e.target.value)}
          placeholder="mk_rza ou https://www.twitch.tv/mk_rza"
          required
        />
      </label>
      {error && (
        <p className="text-sm" style={{ color: "var(--lose)" }}>
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary self-start" disabled={loading}>
        {loading ? "Vérification..." : "Autoriser"}
      </button>
    </form>
  );
}
