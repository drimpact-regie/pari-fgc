"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BracketResetLockButton({
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
      body: JSON.stringify({ bracketResetLocked: !locked }),
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
      title="Verrouille/déverrouille le pari reset de bracket (à faire juste avant la grande finale)"
    >
      {locked ? "🔒 Reset de bracket verrouillé (cliquer pour déverrouiller)" : "Verrouiller le reset de bracket"}
    </button>
  );
}
