"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import CharacterAvatar from "@/components/CharacterAvatar";

interface Character {
  id: string;
  name: string;
  imageUrl: string | null;
}

export default function CharacterImageRow({ character }: { character: Character }) {
  const router = useRouter();
  const [url, setUrl] = useState(character.imageUrl ?? "");
  const [imgStatus, setImgStatus] = useState<"idle" | "loading" | "ok" | "error">(
    character.imageUrl ? "loading" : "idle",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleUrlChange(value: string) {
    setUrl(value);
    setSaved(false);
    setError(null);
    setImgStatus(value.trim() ? "loading" : "idle");
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch(`/api/admin/characters/${character.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: url.trim() }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de l'enregistrement.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  const previewCharacter = {
    name: character.name,
    imageUrl: imgStatus === "ok" ? url.trim() : null,
  };
  const dirty = url.trim() !== (character.imageUrl ?? "");

  return (
    <tr className="border-t" style={{ borderColor: "var(--border)" }}>
      <td className="px-4 py-2">
        <CharacterAvatar character={previewCharacter} size={40} />
        {url.trim() && (
          // Sonde invisible : sert uniquement à détecter si l'URL charge une
          // vraie image, sans dupliquer la logique d'affichage.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url.trim()}
            alt=""
            style={{ display: "none" }}
            onLoad={() => setImgStatus("ok")}
            onError={() => setImgStatus("error")}
          />
        )}
      </td>
      <td className="px-4 py-2 font-medium whitespace-nowrap">{character.name}</td>
      <td className="px-4 py-2">
        <input
          className="input"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://..."
        />
        {imgStatus === "error" && (
          <p className="text-xs mt-1" style={{ color: "var(--lose)" }}>
            Cette URL ne charge pas d&apos;image valide.
          </p>
        )}
        {error && (
          <p className="text-xs mt-1" style={{ color: "var(--lose)" }}>
            {error}
          </p>
        )}
      </td>
      <td className="px-4 py-2 text-right">
        <button
          type="button"
          className="btn text-xs"
          style={{
            background: dirty ? "var(--accent)" : "var(--surface-alt)",
            color: dirty ? "#0b0d12" : "var(--muted)",
          }}
          disabled={saving || (!dirty && !saved)}
          onClick={handleSave}
        >
          {saving ? "..." : saved ? "Enregistré ✓" : "Enregistrer"}
        </button>
      </td>
    </tr>
  );
}
