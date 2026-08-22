"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Inverse J1/J2 pour le match actuellement affiché sur l'overlay OBS
 * "match en cours" (voir InvitationalEvent.activeOverlayMatchSwapped) —
 * pour corriger le cas où les joueurs se sont installés à l'inverse de ce
 * qui était prévu, sans avoir à toucher aux compétiteurs/scores du match
 * lui-même. N'a de sens que pour le match désigné comme actif ; masqué
 * ailleurs par InvitationalMatchRow.
 */
export default function ActiveOverlayMatchSwapButton({
  eventId,
  swapped,
}: {
  eventId: string;
  swapped: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);

    await fetch(`/api/admin/invitational/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeOverlayMatchSwapped: !swapped }),
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
      style={{ background: "var(--surface-alt)", color: "var(--muted)" }}
      title="Inverse l'affichage J1/J2 sur l'overlay 'match en cours'"
    >
      🔄 J1 ⇄ J2
    </button>
  );
}
