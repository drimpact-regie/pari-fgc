"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddCharacterForm({ defaultGame }: { defaultGame: string }) {
  const router = useRouter();
  const [game, setGame] = useState(defaultGame);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/admin/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, name, imageUrl: imageUrl || undefined }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de l'ajout.");
      return;
    }

    setName("");
    setImageUrl("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card p-4 flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="text-sm flex-1">
        Jeu
        <input
          className="input mt-1"
          value={game}
          onChange={(e) => setGame(e.target.value)}
          placeholder="Ex : Marvel Tokon: Fighting Souls"
          required
        />
      </label>
      <label className="text-sm flex-1">
        Nom du personnage
        <input
          className="input mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Phoenix Cyclops"
          required
        />
      </label>
      <label className="text-sm flex-1">
        Image (URL, optionnel)
        <input
          className="input mt-1"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? "..." : "Ajouter"}
      </button>
      {error && (
        <p className="text-sm" style={{ color: "var(--lose)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
