"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddTournamentForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [eventSlug, setEventSlug] = useState("");
  const [twitchChannel, setTwitchChannel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/admin/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, eventSlug, twitchChannel: twitchChannel || undefined }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur lors de la création.");
      return;
    }

    setName("");
    setEventSlug("");
    setTwitchChannel("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 flex flex-col gap-3">
      <label className="text-sm">
        Nom affiché
        <input
          className="input mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Winter Clash 2027"
          required
        />
      </label>
      <label className="text-sm">
        Lien ou slug start.gg de l&apos;event
        <input
          className="input mt-1"
          value={eventSlug}
          onChange={(e) => setEventSlug(e.target.value)}
          placeholder="https://www.start.gg/tournament/xxx/event/yyy"
          required
        />
      </label>
      <label className="text-sm">
        Chaîne Twitch (optionnel)
        <input
          className="input mt-1"
          value={twitchChannel}
          onChange={(e) => setTwitchChannel(e.target.value)}
          placeholder="mk_rza ou https://www.twitch.tv/mk_rza"
        />
      </label>
      {error && (
        <p className="text-sm" style={{ color: "var(--lose)" }}>
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary self-start" disabled={loading}>
        {loading ? "Vérification..." : "Ajouter le tournoi"}
      </button>
    </form>
  );
}
