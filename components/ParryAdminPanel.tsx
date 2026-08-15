"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import TopEightLockButton from "@/components/TopEightLockButton";
import BracketResetLockButton from "@/components/BracketResetLockButton";

interface PendingCharacter {
  characterKey: string;
  character: string;
  betCount: number;
}

function MvcResultRow({
  tournamentId,
  entry,
}: {
  tournamentId: string;
  entry: PendingCharacter;
}) {
  const router = useRouter();
  const [actualCount, setActualCount] = useState(0);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await fetch("/api/admin/sidebets/mvc-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId, characterKey: entry.characterKey, actualCount }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex-1">
        {entry.character}{" "}
        <span style={{ color: "var(--muted)" }}>
          ({entry.betCount} pari{entry.betCount > 1 ? "s" : ""})
        </span>
      </span>
      <input
        type="number"
        min={0}
        max={8}
        className="input"
        style={{ width: "5rem" }}
        value={actualCount}
        onChange={(e) => setActualCount(Number(e.target.value))}
      />
      <button type="button" className="btn btn-primary" disabled={saving} onClick={submit}>
        {saving ? "..." : "Valider"}
      </button>
    </div>
  );
}

export default function ParryAdminPanel({
  tournamentId,
  topEightLocked,
  bracketResetLocked,
  bracketResetActual,
  detectedBracketReset,
  pendingCharacters,
}: {
  tournamentId: string;
  topEightLocked: boolean;
  bracketResetLocked: boolean;
  bracketResetActual: boolean | null;
  detectedBracketReset: boolean | null;
  pendingCharacters: PendingCharacter[];
}) {
  const router = useRouter();
  const [savingReset, setSavingReset] = useState(false);

  async function setBracketResetActual(value: boolean) {
    setSavingReset(true);
    await fetch(`/api/admin/tournaments/${tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bracketResetActual: value }),
    });
    setSavingReset(false);
    router.refresh();
  }

  return (
    <div className="card p-4 flex flex-col gap-4" style={{ borderColor: "var(--accent)" }}>
      <p className="text-sm font-semibold">Admin — Le Pari du Parry</p>

      <div className="flex flex-wrap gap-2">
        <TopEightLockButton tournamentId={tournamentId} locked={topEightLocked} />
        <BracketResetLockButton tournamentId={tournamentId} locked={bracketResetLocked} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
          Résultat reset de bracket
        </p>
        {bracketResetActual != null ? (
          <p className="text-sm">Réel : {bracketResetActual ? "Oui" : "Non"}</p>
        ) : (
          <div className="flex items-center gap-2">
            {detectedBracketReset != null && (
              <span className="text-xs" style={{ color: "var(--accent)" }}>
                Détecté automatiquement : {detectedBracketReset ? "Oui" : "Non"} (à confirmer)
              </span>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingReset}
              onClick={() => setBracketResetActual(true)}
            >
              Oui
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: "var(--surface-alt)" }}
              disabled={savingReset}
              onClick={() => setBracketResetActual(false)}
            >
              Non
            </button>
          </div>
        )}
      </div>

      {pendingCharacters.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
            Résultats MVC à saisir
          </p>
          {pendingCharacters.map((entry) => (
            <MvcResultRow key={entry.characterKey} tournamentId={tournamentId} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
