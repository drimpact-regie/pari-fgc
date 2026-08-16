"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InvitationalEventStatusEditor({
  eventId,
  status,
}: {
  eventId: string;
  status: "ACTIVE" | "PAST";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const res = await fetch(`/api/admin/invitational/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status === "ACTIVE" ? "PAST" : "ACTIVE" }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className="text-xs px-2 py-1 rounded-md"
      style={
        status === "ACTIVE"
          ? { background: "var(--win)", color: "#0b0d12", fontWeight: 600 }
          : { background: "var(--surface-alt)", color: "var(--muted)" }
      }
    >
      {loading ? "..." : status === "ACTIVE" ? "Actif" : "Passé"}
    </button>
  );
}
