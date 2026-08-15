"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TopEightLockButton({
  tournamentId,
  locked,
}: {
  tournamentId: string;
  locked: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);

    await fetch(`/api/admin/tournaments/${tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topEightLocked: !locked }),
    });

    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="text-xs px-3 py-1.5 rounded-md self-start"
      style={{
        background: locked ? "var(--lose)" : "var(--surface-alt)",
        color: locked ? "#fff" : "var(--muted)",
      }}
      title="Verrouille/déverrouille les pronostics Top 8 (web et chat) pour ce tournoi"
    >
      {locked ? "🔒 Top 8 verrouillé (cliquer pour déverrouiller)" : "Verrouiller le Top 8"}
    </button>
  );
}
