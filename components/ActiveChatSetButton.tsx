"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ActiveChatSetButton({
  tournamentId,
  setId,
  active,
}: {
  tournamentId: string;
  setId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);

    await fetch(`/api/admin/tournaments/${tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeChatSetId: active ? "" : setId }),
    });

    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="text-xs px-2 py-1 rounded"
      style={{
        background: active ? "var(--accent)" : "var(--surface-alt)",
        color: active ? "#0b0d12" : "var(--muted)",
      }}
      title="Marquer ce match comme celui sur lequel le chat Twitch peut parier avec !bet"
    >
      {active ? "📺 Match du chat" : "Définir pour le chat"}
    </button>
  );
}
