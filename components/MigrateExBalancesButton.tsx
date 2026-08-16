"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface MigrationResult {
  usersProcessed: number;
  usersChanged: number;
  changed: { username: string; previousBalance: number; newBalance: number }[];
}

export default function MigrateExBalancesButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/admin/migrate-ex-balances", { method: "POST" });
    const data = await res.json().catch(() => ({}));

    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur lors de la migration.");
      return;
    }

    setResult(data);
    router.refresh();
  }

  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Migrer les soldes existants</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Convertit les gains déjà accumulés (paris, MVC, reset de bracket, Top 8) en solde Ex
            de départ, pour les comptes créés avant l&apos;introduction d&apos;Ex. Sans effet sur
            les comptes sans historique. Peut être relancé sans risque (idempotent).
          </p>
        </div>
        <button type="button" className="btn btn-primary text-xs whitespace-nowrap" disabled={loading} onClick={handleClick}>
          {loading ? "..." : "Migrer"}
        </button>
      </div>

      {error && (
        <p className="text-xs" style={{ color: "var(--lose)" }}>
          {error}
        </p>
      )}

      {result && (
        <div className="text-xs flex flex-col gap-1">
          <p style={{ color: "var(--win)" }}>
            {result.usersProcessed} compte{result.usersProcessed > 1 ? "s" : ""} analysé
            {result.usersProcessed > 1 ? "s" : ""}, {result.usersChanged} solde
            {result.usersChanged > 1 ? "s" : ""} mis à jour.
          </p>
          {result.changed.map((c) => (
            <p key={c.username} style={{ color: "var(--muted)" }}>
              {c.username} : {c.previousBalance} → <span style={{ color: "var(--gold)" }}>{c.newBalance} Ex</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
