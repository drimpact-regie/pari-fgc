"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  BRACKET_OVERLAY_ELEMENT_KEYS,
  BRACKET_OVERLAY_ELEMENT_LABELS,
  OVERLAY_CANVAS_HEIGHT,
  OVERLAY_CANVAS_WIDTH,
  type BracketOverlayElementKey,
  type BracketOverlayLayout,
} from "@/lib/invitationalBracketOverlayLayout";

export default function InvitationalBracketOverlayLayoutEditor({
  eventId,
  initialLayout,
}: {
  eventId: string;
  initialLayout: BracketOverlayLayout;
}) {
  const router = useRouter();
  const [layout, setLayout] = useState(initialLayout);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateField(key: BracketOverlayElementKey, field: "x" | "y" | "size", value: string) {
    const num = Number(value);
    setLayout((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: Number.isFinite(num) ? num : prev[key][field] },
    }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch(`/api/admin/invitational/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bracketOverlayLayout: layout }),
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

  return (
    <div className="card p-4 flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold">Overlay &quot;Bracket / classement&quot; — positions et tailles</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Ajustez la position et la taille des encadrés classement et liste de matchs affichés sur
          l&apos;overlay OBS pour ce format.
        </p>
      </div>

      <Preview layout={layout} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {BRACKET_OVERLAY_ELEMENT_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs w-28 shrink-0" style={{ color: "var(--muted)" }}>
              {BRACKET_OVERLAY_ELEMENT_LABELS[key]}
            </span>
            <label className="text-xs">
              X
              <input
                type="number"
                className="input mt-1"
                style={{ width: "4.5rem" }}
                value={layout[key].x}
                onChange={(e) => updateField(key, "x", e.target.value)}
              />
            </label>
            <label className="text-xs">
              Y
              <input
                type="number"
                className="input mt-1"
                style={{ width: "4.5rem" }}
                value={layout[key].y}
                onChange={(e) => updateField(key, "y", e.target.value)}
              />
            </label>
            <label className="text-xs">
              Taille
              <input
                type="number"
                step="0.1"
                min="0.1"
                className="input mt-1"
                style={{ width: "4.5rem" }}
                value={layout[key].size}
                onChange={(e) => updateField(key, "size", e.target.value)}
              />
            </label>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary text-xs" disabled={saving} onClick={handleSave}>
          {saving ? "..." : saved ? "Enregistré ✓" : "Enregistrer"}
        </button>
        {error && (
          <span className="text-xs" style={{ color: "var(--lose)" }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Aperçu léger : miniature avec le libellé de chaque encadré positionné et
 * mis à l'échelle en CSS pur (mêmes pourcentages/scale que le rendu overlay
 * réel — voir components/overlay/OverlayBracketView.tsx). Pas de fond
 * personnalisable pour cet overlay (contrairement à "match en cours") :
 * damier neutre uniquement, pour situer les encadrés l'un par rapport à
 * l'autre.
 */
function Preview({ layout }: { layout: BracketOverlayLayout }) {
  return (
    <div
      className="rounded-md overflow-hidden relative"
      style={{
        width: "100%",
        maxWidth: "40rem",
        aspectRatio: "16/9",
        containerType: "inline-size",
        background: "repeating-conic-gradient(#1f2937 0% 25%, #111827 0% 50%) 0 0 / 20px 20px",
      }}
    >
      {BRACKET_OVERLAY_ELEMENT_KEYS.map((key) => {
        const pos = layout[key];
        return (
          <div
            key={key}
            className="whitespace-nowrap rounded px-2 py-1"
            title={BRACKET_OVERLAY_ELEMENT_LABELS[key]}
            style={{
              position: "absolute",
              left: `${(pos.x / OVERLAY_CANVAS_WIDTH) * 100}%`,
              top: `${(pos.y / OVERLAY_CANVAS_HEIGHT) * 100}%`,
              transform: `scale(${pos.size})`,
              transformOrigin: "top left",
              fontSize: "1.3cqw",
              fontWeight: 700,
              color: "#fff",
              background: "rgba(11,13,18,0.72)",
            }}
          >
            {BRACKET_OVERLAY_ELEMENT_LABELS[key]}
          </div>
        );
      })}
    </div>
  );
}
