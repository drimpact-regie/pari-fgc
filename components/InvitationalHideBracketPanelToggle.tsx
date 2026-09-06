"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Masque l'encadré principal (arbre de bracket, ou classement/liste de
 * matchs pour les formats sans bracket) de l'overlay "bracket/classement",
 * en ne laissant que le bandeau défilant du bas (prochains matchs + gagnants
 * de paris) — voir InvitationalEvent.hideBracketOverlayPanel. Utile quand
 * l'arbre complet prend trop de place à l'écran mais que le bandeau reste
 * souhaité.
 */
export default function InvitationalHideBracketPanelToggle({
  eventId,
  hidden,
}: {
  eventId: string;
  hidden: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);

    await fetch(`/api/admin/invitational/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hideBracketOverlayPanel: !hidden }),
    });

    setLoading(false);
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--muted)" }}>
      <input type="checkbox" checked={hidden} disabled={loading} onChange={handleToggle} />
      N&apos;afficher que le bandeau défilant (masquer l&apos;arbre de bracket / classement)
    </label>
  );
}
