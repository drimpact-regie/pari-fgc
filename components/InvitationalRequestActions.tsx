"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ConfirmResult {
  accessUrl: string | null;
  emailSent: boolean;
}

export default function InvitationalRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/invitational/requests/${requestId}/confirm`, { method: "POST" });
    setBusy(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de la confirmation.");
      return;
    }

    const data = await res.json();
    setResult({ accessUrl: data.accessUrl ?? null, emailSent: Boolean(data.emailSent) });
    router.refresh();
  }

  async function reject() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/invitational/requests/${requestId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setBusy(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors du refus.");
      return;
    }

    router.refresh();
  }

  if (result) {
    return (
      <div className="text-xs flex flex-col gap-1 items-end max-w-[16rem]">
        <span style={{ color: "var(--win)" }}>Demande confirmée.</span>
        {result.accessUrl &&
          (result.emailSent ? (
            <span style={{ color: "var(--muted)" }}>Email envoyé au prestataire.</span>
          ) : (
            <>
              <span style={{ color: "var(--lose)" }}>Email non envoyé — transmets ce lien à la main :</span>
              <a href={result.accessUrl} className="underline break-all" style={{ color: "var(--accent)" }}>
                {result.accessUrl}
              </a>
            </>
          ))}
      </div>
    );
  }

  if (rejecting) {
    return (
      <div className="flex flex-col gap-2 items-end">
        <input
          className="input text-xs"
          placeholder="Motif (optionnel)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <button type="button" className="btn text-xs" disabled={busy} onClick={reject}>
            Confirmer le refus
          </button>
          <button type="button" className="btn text-xs" disabled={busy} onClick={() => setRejecting(false)}>
            Annuler
          </button>
        </div>
        {error && (
          <span className="text-xs" style={{ color: "var(--lose)" }}>
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary text-xs" disabled={busy} onClick={confirm}>
          Confirmer
        </button>
        <button type="button" className="btn text-xs" disabled={busy} onClick={() => setRejecting(true)}>
          Refuser
        </button>
      </div>
      {error && (
        <span className="text-xs" style={{ color: "var(--lose)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
