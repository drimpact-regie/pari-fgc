"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ActiveChatInvitationalMatchButton({
  eventId,
  matchId,
  active,
}: {
  eventId: string;
  matchId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);

    await fetch(`/api/admin/invitational/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeChatMatchId: active ? "" : matchId }),
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
      title="Priorité pour !bet en cas de nom ambigu entre plusieurs matchs ouverts de cet event"
    >
      {active ? "📺 Priorité chat" : "Prioriser pour le chat"}
    </button>
  );
}
