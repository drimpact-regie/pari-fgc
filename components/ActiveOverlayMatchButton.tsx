"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Désigne le match affiché sur l'overlay OBS "match en cours"
 * (/overlay/invitational/[eventId]/match) — un seul à la fois par event,
 * indépendant du statut "ouvert au pari" (voir Partie 1 du prompt overlay).
 */
export default function ActiveOverlayMatchButton({
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
      body: JSON.stringify({ activeOverlayMatchId: active ? "" : matchId }),
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
        background: active ? "var(--gold)" : "var(--surface-alt)",
        color: active ? "#0b0d12" : "var(--muted)",
      }}
      title="Affiche ce match sur l'overlay OBS 'match en cours'"
    >
      {active ? "🎥 Sur l'overlay" : "Afficher sur l'overlay"}
    </button>
  );
}
