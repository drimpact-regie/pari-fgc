"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

// Pas d'abonnement réel nécessaire (l'origine ne change jamais en cours de
// vie de la page) — un no-op suffit pour useSyncExternalStore.
function subscribeNoop() {
  return () => {};
}
function getOrigin() {
  return window.location.origin;
}
function getServerOrigin() {
  return "";
}

interface RundownConfig {
  rundownMinSecondsPerRound: number;
  rundownMaxSecondsPerRound: number;
  rundownSetupSeconds: number;
  rundownVerifSeconds: number;
  rundownStartAt: Date | null;
}

function toDatetimeLocalValue(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Réglages overlay OBS d'un event : liens des deux Browser Source (match en
 * cours / bracket) et constantes du calcul d'estimation d'horaires
 * (Rundown), reproduites côté site — voir lib/invitationalRundown.ts et
 * docs/invitational-import-format.md pour la formule d'origine (fichier
 * Excel).
 */
export default function InvitationalOverlaySettings({
  eventId,
  config,
}: {
  eventId: string;
  config: RundownConfig;
}) {
  const router = useRouter();
  const [minSec, setMinSec] = useState(String(config.rundownMinSecondsPerRound));
  const [maxSec, setMaxSec] = useState(String(config.rundownMaxSecondsPerRound));
  const [setupSec, setSetupSec] = useState(String(config.rundownSetupSeconds));
  const [verifSec, setVerifSec] = useState(String(config.rundownVerifSeconds));
  const [startAt, setStartAt] = useState(toDatetimeLocalValue(config.rundownStartAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Rendu serveur sans accès à window : useSyncExternalStore renvoie
  // getServerOrigin ("") côté serveur ET au tout premier rendu client (avant
  // hydratation, pour rester identique au HTML serveur — pas de mismatch),
  // puis re-rend avec la vraie origine une fois monté — nécessaire pour que
  // l'URL copiée dans OBS soit absolue.
  const origin = useSyncExternalStore(subscribeNoop, getOrigin, getServerOrigin);

  const matchOverlayUrl = `${origin}/overlay/invitational/${eventId}/match`;
  const bracketOverlayUrl = `${origin}/overlay/invitational/${eventId}/bracket`;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch(`/api/admin/invitational/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rundownMinSecondsPerRound: Number(minSec),
        rundownMaxSecondsPerRound: Number(maxSec),
        rundownSetupSeconds: Number(setupSec),
        rundownVerifSeconds: Number(verifSec),
        rundownStartAt: startAt ? new Date(startAt).toISOString() : "",
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de l'enregistrement.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl((c) => (c === url ? null : c)), 2000);
    } catch {
      // best-effort — pas grave si le presse-papier est indisponible, l'URL reste sélectionnable.
    }
  }

  return (
    <div className="card p-4 flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold">Overlays OBS</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          À ajouter comme Browser Source dans OBS. Le contenu se met à jour tout seul, pas besoin de
          recharger la source après un changement. Pour &quot;Match en cours&quot;, configurez la
          Browser Source en 1920x1080 (ou un autre format 16:9, ex. 960x540) : les positions réglées
          ci-dessous sont calées sur ce repère — voir le fond et les positions personnalisables plus
          bas.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {[
          { label: "Match en cours (score)", url: matchOverlayUrl },
          { label: "Bracket / classement + prochains matchs", url: bracketOverlayUrl },
        ].map(({ label, url }) => (
          <div key={label} className="flex items-center gap-2 flex-wrap">
            <span className="text-xs" style={{ color: "var(--muted)", minWidth: "16rem" }}>
              {label}
            </span>
            <code className="text-xs px-2 py-1 rounded flex-1 min-w-0 truncate" style={{ background: "var(--surface-alt)" }}>
              {url}
            </code>
            <button type="button" className="text-xs underline shrink-0" style={{ color: "var(--accent)" }} onClick={() => copyUrl(url)}>
              {copiedUrl === url ? "Copié ✓" : "Copier"}
            </button>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm font-semibold">Estimation d&apos;horaires (Rundown)</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Même formule que le fichier Excel Rundown — alimente l&apos;encart &quot;prochains matchs&quot;
          de l&apos;overlay bracket.
        </p>
        <div className="flex flex-wrap items-end gap-2 mt-2">
          <label className="text-xs">
            Round le plus court (s)
            <input className="input mt-1" style={{ width: "6rem" }} value={minSec} onChange={(e) => setMinSec(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
          </label>
          <label className="text-xs">
            Round le plus long (s)
            <input className="input mt-1" style={{ width: "6rem" }} value={maxSec} onChange={(e) => setMaxSec(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
          </label>
          <label className="text-xs">
            Installation (s)
            <input className="input mt-1" style={{ width: "6rem" }} value={setupSec} onChange={(e) => setSetupSec(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
          </label>
          <label className="text-xs">
            Vérif manette (s)
            <input className="input mt-1" style={{ width: "6rem" }} value={verifSec} onChange={(e) => setVerifSec(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
          </label>
          <label className="text-xs">
            Début de l&apos;event
            <input type="datetime-local" className="input mt-1" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </label>
          <button type="button" className="btn text-xs" style={{ background: "var(--accent)", color: "#0b0d12" }} disabled={saving} onClick={handleSave}>
            {saving ? "..." : saved ? "Enregistré ✓" : "Enregistrer"}
          </button>
        </div>
        {error && (
          <p className="text-xs mt-1" style={{ color: "var(--lose)" }}>
            {error}
          </p>
        )}
        {!startAt && (
          <p className="text-xs mt-1 italic" style={{ color: "var(--muted)" }}>
            Sans heure de début, l&apos;overlay bracket n&apos;affiche pas d&apos;estimation d&apos;horaires.
          </p>
        )}
      </div>
    </div>
  );
}
