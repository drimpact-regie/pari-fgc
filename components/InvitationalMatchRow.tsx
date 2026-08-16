"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import ActiveChatInvitationalMatchButton from "@/components/ActiveChatInvitationalMatchButton";

interface Competitor {
  id: string;
  name: string;
  tag: string | null;
  countryCode: string | null;
}

interface Match {
  id: string;
  groupLabel: string | null;
  orderIndex: number;
  status: "NOT_OPEN" | "OPEN" | "CLOSED" | "COMPLETED";
  competitorA: Competitor | null;
  competitorB: Competitor | null;
  winnerId: string | null;
  scoreA: number | null;
  scoreB: number | null;
}

const STATUS_LABELS: Record<Match["status"], string> = {
  NOT_OPEN: "Pas encore ouvert",
  OPEN: "Ouvert au pari",
  CLOSED: "Fermé",
  COMPLETED: "Terminé",
};

function CompetitorFields({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: Competitor;
  onChange: (next: Competitor) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <input
        className="input"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        placeholder="Nom du joueur"
        disabled={disabled}
      />
      <div className="flex gap-1.5">
        <input
          className="input"
          value={value.tag ?? ""}
          onChange={(e) => onChange({ ...value, tag: e.target.value || null })}
          placeholder="Tag / équipe (optionnel)"
          disabled={disabled}
        />
        <input
          className="input"
          style={{ width: "4.5rem" }}
          value={value.countryCode ?? ""}
          onChange={(e) => onChange({ ...value, countryCode: e.target.value.toUpperCase() || null })}
          placeholder="Pays"
          maxLength={2}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export default function InvitationalMatchRow({
  match,
  eventId,
  showChatButton,
  isActiveChatMatch,
}: {
  match: Match;
  eventId: string;
  showChatButton: boolean;
  isActiveChatMatch: boolean;
}) {
  const router = useRouter();
  const locked = match.status === "COMPLETED";

  const [competitorA, setCompetitorA] = useState<Competitor>(
    match.competitorA ?? { id: "", name: "", tag: null, countryCode: null },
  );
  const [competitorB, setCompetitorB] = useState<Competitor>(
    match.competitorB ?? { id: "", name: "", tag: null, countryCode: null },
  );
  const [status, setStatus] = useState<Match["status"]>(match.status);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [winnerId, setWinnerId] = useState("");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [declaring, setDeclaring] = useState(false);
  const [declareError, setDeclareError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const res = await fetch(`/api/admin/invitational/matches/${match.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(competitorA.id
          ? { competitorA: { name: competitorA.name, tag: competitorA.tag, countryCode: competitorA.countryCode } }
          : {}),
        ...(competitorB.id
          ? { competitorB: { name: competitorB.name, tag: competitorB.tag, countryCode: competitorB.countryCode } }
          : {}),
        status,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveError(data.error ?? "Erreur lors de l'enregistrement.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  async function handleDeclare(e: React.FormEvent) {
    e.preventDefault();
    if (!winnerId) {
      setDeclareError("Sélectionne le vainqueur.");
      return;
    }
    setDeclaring(true);
    setDeclareError(null);

    const res = await fetch(`/api/admin/invitational/matches/${match.id}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        winnerId,
        scoreA: scoreA.trim() === "" ? null : Number(scoreA),
        scoreB: scoreB.trim() === "" ? null : Number(scoreB),
      }),
    });

    setDeclaring(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeclareError(data.error ?? "Erreur lors de la déclaration du résultat.");
      return;
    }

    router.refresh();
  }

  const canDeclareResult = !locked && Boolean(competitorA.id) && Boolean(competitorB.id);

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {match.groupLabel ? `${match.groupLabel} — ` : ""}Match #{match.orderIndex + 1}
        </span>
        <div className="flex items-center gap-2">
          {showChatButton && match.status === "OPEN" && (
            <ActiveChatInvitationalMatchButton eventId={eventId} matchId={match.id} active={isActiveChatMatch} />
          )}
          {locked ? (
            <span className="text-xs px-2 py-1 rounded-md" style={{ background: "var(--surface-alt)", color: "var(--win)" }}>
              {STATUS_LABELS.COMPLETED}
            </span>
          ) : (
            <select
              className="input text-xs"
              style={{ width: "auto" }}
              value={status}
              onChange={(e) => setStatus(e.target.value as Match["status"])}
            >
              <option value="NOT_OPEN">{STATUS_LABELS.NOT_OPEN}</option>
              <option value="OPEN">{STATUS_LABELS.OPEN}</option>
              <option value="CLOSED">{STATUS_LABELS.CLOSED}</option>
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CompetitorFields label="Joueur A" value={competitorA} onChange={setCompetitorA} disabled={locked} />
        <CompetitorFields label="Joueur B" value={competitorB} onChange={setCompetitorB} disabled={locked} />
      </div>

      {!locked && (
        <div className="flex items-center gap-2">
          <button type="button" className="btn text-xs" style={{ background: "var(--accent)", color: "#0b0d12" }} disabled={saving} onClick={handleSave}>
            {saving ? "..." : saved ? "Enregistré ✓" : "Enregistrer"}
          </button>
          {saveError && (
            <span className="text-xs" style={{ color: "var(--lose)" }}>
              {saveError}
            </span>
          )}
        </div>
      )}

      {locked ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Vainqueur : <strong>{match.winnerId === match.competitorA?.id ? competitorA.name : competitorB.name}</strong>
          {(match.scoreA !== null || match.scoreB !== null) && ` (${match.scoreA ?? "?"} - ${match.scoreB ?? "?"})`}
        </p>
      ) : canDeclareResult ? (
        <form onSubmit={handleDeclare} className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
            Déclarer le résultat (déclenche la résolution des paris)
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              Vainqueur
              <select className="input mt-1" value={winnerId} onChange={(e) => setWinnerId(e.target.value)} required>
                <option value="">—</option>
                <option value={competitorA.id}>{competitorA.name || "Joueur A"}</option>
                <option value={competitorB.id}>{competitorB.name || "Joueur B"}</option>
              </select>
            </label>
            <label className="text-xs">
              Score A
              <input className="input mt-1" style={{ width: "4rem" }} value={scoreA} onChange={(e) => setScoreA(e.target.value)} inputMode="numeric" />
            </label>
            <label className="text-xs">
              Score B
              <input className="input mt-1" style={{ width: "4rem" }} value={scoreB} onChange={(e) => setScoreB(e.target.value)} inputMode="numeric" />
            </label>
            <button type="submit" className="btn btn-primary text-xs" disabled={declaring}>
              {declaring ? "..." : "Déclarer le résultat"}
            </button>
          </div>
          {declareError && (
            <span className="text-xs" style={{ color: "var(--lose)" }}>
              {declareError}
            </span>
          )}
        </form>
      ) : null}
    </div>
  );
}
