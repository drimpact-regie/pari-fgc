"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ExAdjustmentForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amount);
  const valid = amount.trim() !== "" && Number.isInteger(amountNum) && amountNum !== 0 && reason.trim() !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/admin/users/${userId}/ex-adjustments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountNum, reason: reason.trim() }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur.");
      return;
    }

    setAmount("");
    setReason("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
      <input
        type="number"
        step={1}
        placeholder="+/- Ex"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="input text-xs"
        style={{ width: "6rem" }}
      />
      <input
        type="text"
        placeholder="Raison"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="input text-xs"
        style={{ width: "12rem" }}
      />
      <button type="submit" className="btn text-xs" disabled={!valid || submitting}>
        {submitting ? "..." : "Appliquer"}
      </button>
      {error && (
        <span className="text-xs" style={{ color: "var(--lose)" }}>
          {error}
        </span>
      )}
    </form>
  );
}
