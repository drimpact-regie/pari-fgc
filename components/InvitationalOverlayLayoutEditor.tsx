"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  OVERLAY_CANVAS_HEIGHT,
  OVERLAY_CANVAS_WIDTH,
  OVERLAY_ELEMENT_KEYS,
  OVERLAY_ELEMENT_LABELS,
  type OverlayElementKey,
  type OverlayLayout,
} from "@/lib/invitationalOverlayLayout";
import { MAX_OVERLAY_BACKGROUND_BASE64_LENGTH } from "@/lib/invitationalOverlayImage";
import CountryBadge from "@/components/overlay/CountryBadge";

/**
 * Taille/couleur/poids par élément — copie exacte de ce que rend
 * components/overlay/OverlayMatchView.tsx pour CET élément, afin que
 * l'aperçu reflète fidèlement le rendu réel (plutôt qu'une étiquette
 * générique à taille uniforme, qui donnait une impression de chevauchement
 * ne correspondant pas à ce qui s'affiche vraiment sur le stream).
 */
const PREVIEW_ELEMENT_STYLE: Record<OverlayElementKey, { fontSize: string; color: string; weight: number }> = {
  stage: { fontSize: "1.6cqw", color: "#fbbf24", weight: 700 },
  ft: { fontSize: "1.3cqw", color: "#9ca3af", weight: 600 },
  nameA: { fontSize: "2.4cqw", color: "#fff", weight: 800 },
  tagA: { fontSize: "1.4cqw", color: "#d1d5db", weight: 600 },
  scoreA: { fontSize: "3cqw", color: "#fff", weight: 900 },
  nameB: { fontSize: "2.4cqw", color: "#fff", weight: 800 },
  tagB: { fontSize: "1.4cqw", color: "#d1d5db", weight: 600 },
  scoreB: { fontSize: "3cqw", color: "#fff", weight: 900 },
  flagA: { fontSize: "1.1cqw", color: "#fff", weight: 700 },
  flagB: { fontSize: "1.1cqw", color: "#fff", weight: 700 },
};

const FLAG_KEYS: OverlayElementKey[] = ["flagA", "flagB"];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Image illisible."));
    img.src = dataUrl;
  });
}

export default function InvitationalOverlayLayoutEditor({
  eventId,
  initialBackgroundUrl,
  initialLayout,
}: {
  eventId: string;
  initialBackgroundUrl: string | null;
  initialLayout: OverlayLayout;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [backgroundUrl, setBackgroundUrl] = useState(initialBackgroundUrl);
  const [layout, setLayout] = useState(initialLayout);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setWarning(null);
    setSaved(false);

    if (file.type !== "image/png") {
      setError("Le fond doit être une image PNG.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (dataUrl.length > MAX_OVERLAY_BACKGROUND_BASE64_LENGTH) {
        setError("Image trop volumineuse (4 Mo max).");
        return;
      }
      const { width, height } = await readImageDimensions(dataUrl);
      if (width !== OVERLAY_CANVAS_WIDTH || height !== OVERLAY_CANVAS_HEIGHT) {
        setWarning(
          `Image ${width}x${height} — un format ${OVERLAY_CANVAS_WIDTH}x${OVERLAY_CANVAS_HEIGHT} est recommandé pour que les positions ci-dessous tombent au bon endroit.`,
        );
      }
      setBackgroundUrl(dataUrl);
    } catch {
      setError("Impossible de lire ce fichier.");
    }
  }

  function clearBackground() {
    setBackgroundUrl(null);
    setWarning(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function updatePosition(key: OverlayElementKey, axis: "x" | "y", value: string) {
    const num = Number(value);
    setLayout((prev) => ({
      ...prev,
      [key]: { ...prev[key], [axis]: Number.isFinite(num) ? num : prev[key][axis] },
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
      body: JSON.stringify({ overlayBackgroundUrl: backgroundUrl ?? "", overlayLayout: layout }),
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
        <p className="text-sm font-semibold">Overlay &quot;Match en cours&quot; — fond et positions</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Chaque jeu a ses zones de HUD à des endroits différents : uploadez le fond de VOTRE
          event ({OVERLAY_CANVAS_WIDTH}x{OVERLAY_CANVAS_HEIGHT}, PNG avec transparence) et ajustez
          la position de chaque élément en conséquence. Sans fond, l&apos;overlay reste transparent
          (comportement actuel).
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept="image/png" className="input" onChange={handleFileChange} />
          {backgroundUrl && (
            <button type="button" className="btn text-xs" onClick={clearBackground}>
              Retirer le fond
            </button>
          )}
        </div>
        {warning && (
          <p className="text-xs" style={{ color: "var(--gold)" }}>
            {warning}
          </p>
        )}
      </div>

      <Preview backgroundUrl={backgroundUrl} layout={layout} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {OVERLAY_ELEMENT_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs w-20 shrink-0" style={{ color: "var(--muted)" }}>
              {OVERLAY_ELEMENT_LABELS[key]}
            </span>
            <label className="text-xs">
              X
              <input
                type="number"
                className="input mt-1"
                style={{ width: "5.5rem" }}
                value={layout[key].x}
                onChange={(e) => updatePosition(key, "x", e.target.value)}
              />
            </label>
            <label className="text-xs">
              Y
              <input
                type="number"
                className="input mt-1"
                style={{ width: "5.5rem" }}
                value={layout[key].y}
                onChange={(e) => updatePosition(key, "y", e.target.value)}
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
 * Aperçu léger (pas d'éditeur drag-and-drop) : miniature du fond avec le
 * libellé de chaque élément positionné en CSS pur (mêmes pourcentages que
 * le rendu overlay réel) — assez pour valider un positionnement sans avoir
 * à ouvrir la page overlay séparément.
 *
 * Largeur responsive (100% du conteneur, plafonnée à 40rem) plutôt qu'une
 * largeur fixe en pixels : une largeur fixe déborde sur un écran étroit
 * (mobile) et écrase l'affichage. Le ratio 16:9 est lui gardé fixe (voir
 * aspectRatio) pour que les pourcentages tombent au même endroit que sur le
 * rendu overlay réel — voir components/overlay/OverlayMatchView.tsx, même
 * technique. La taille du texte suit la largeur réelle du conteneur (cqw)
 * pour rester lisible aussi bien en petit qu'en grand.
 */
function Preview({ backgroundUrl, layout }: { backgroundUrl: string | null; layout: OverlayLayout }) {
  return (
    <div
      className="rounded-md overflow-hidden relative"
      style={{
        width: "100%",
        maxWidth: "40rem",
        aspectRatio: "16/9",
        containerType: "inline-size",
        background: backgroundUrl ? undefined : "repeating-conic-gradient(#1f2937 0% 25%, #111827 0% 50%) 0 0 / 20px 20px",
      }}
    >
      {backgroundUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- aperçu d'une image en data: URL locale.
        <img src={backgroundUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}
      {OVERLAY_ELEMENT_KEYS.map((key) => {
        const pos = {
          position: "absolute" as const,
          left: `${(layout[key].x / OVERLAY_CANVAS_WIDTH) * 100}%`,
          top: `${(layout[key].y / OVERLAY_CANVAS_HEIGHT) * 100}%`,
        };
        if (FLAG_KEYS.includes(key)) {
          return (
            <span key={key} style={pos} title={OVERLAY_ELEMENT_LABELS[key]}>
              <CountryBadge countryCode="XX" fontSize={PREVIEW_ELEMENT_STYLE[key].fontSize} />
            </span>
          );
        }
        const style = PREVIEW_ELEMENT_STYLE[key];
        return (
          <span
            key={key}
            className="whitespace-nowrap"
            title={OVERLAY_ELEMENT_LABELS[key]}
            style={{
              ...pos,
              fontSize: style.fontSize,
              fontWeight: style.weight,
              color: style.color,
              textShadow: "0 2px 6px rgba(0,0,0,0.85)",
            }}
          >
            {OVERLAY_ELEMENT_LABELS[key]}
          </span>
        );
      })}
    </div>
  );
}
