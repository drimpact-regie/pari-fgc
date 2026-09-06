"use client";

import { useState } from "react";

interface PresetSummary {
  id: string;
  name: string;
  overlayLayout: unknown;
  bracketOverlayLayout: unknown;
}

/**
 * Sauvegarde/réapplication d'un calage d'overlay nommé (voir
 * InvitationalOverlayPreset) — capture d'un coup les deux overlays (Match en
 * cours + Bracket/classement) TELS QU'ENREGISTRÉS pour cet event (pas les
 * modifications en cours, non sauvegardées, dans les éditeurs ci-dessous),
 * pour les réappliquer sur un autre event sans tout recaler.
 */
export default function InvitationalOverlayPresetManager({
  eventId,
  currentOverlayLayout,
  currentBracketOverlayLayout,
  initialPresets,
}: {
  eventId: string;
  currentOverlayLayout: unknown;
  currentBracketOverlayLayout: unknown;
  initialPresets: PresetSummary[];
}) {
  const [presets, setPresets] = useState(initialPresets);
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState(initialPresets[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSaveAsPreset() {
    if (!name.trim()) {
      setError("Donnez un nom au preset.");
      setMessage(null);
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/admin/invitational/overlay-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        overlayLayout: currentOverlayLayout,
        bracketOverlayLayout: currentBracketOverlayLayout,
      }),
    });

    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'enregistrement du preset.");
      return;
    }
    const created: PresetSummary = data.preset;
    setPresets((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedId(created.id);
    setName("");
    setMessage(`Preset « ${created.name} » enregistré.`);
  }

  async function handleApplyPreset() {
    const preset = presets.find((p) => p.id === selectedId);
    if (!preset) return;
    setApplying(true);
    setError(null);
    setMessage(null);

    const res = await fetch(`/api/admin/invitational/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        overlayLayout: preset.overlayLayout ?? undefined,
        bracketOverlayLayout: preset.bracketOverlayLayout ?? undefined,
      }),
    });

    if (!res.ok) {
      setApplying(false);
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de l'application du preset.");
      return;
    }

    // Rechargement complet (pas router.refresh) : les deux éditeurs
    // d'overlay initialisent leur état local une seule fois depuis leurs
    // props (useState(initialLayout)) sans jamais le resynchroniser tout
    // seuls — un simple refresh laisserait leurs champs affichés
    // désynchronisés du calage qu'on vient d'appliquer.
    window.location.reload();
  }

  async function handleDeletePreset() {
    const preset = presets.find((p) => p.id === selectedId);
    if (!preset) return;
    setDeleting(true);
    setError(null);
    setMessage(null);

    const res = await fetch(`/api/admin/invitational/overlay-presets/${preset.id}`, { method: "DELETE" });

    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de la suppression.");
      return;
    }
    const remaining = presets.filter((p) => p.id !== preset.id);
    setPresets(remaining);
    setSelectedId(remaining[0]?.id ?? "");
    setMessage(`Preset « ${preset.name} » supprimé.`);
  }

  return (
    <div className="card p-4 flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold">Presets d&apos;overlay (calage réutilisable)</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Sauvegardez le calage déjà enregistré de cet event (positions, tailles et couleurs des
          deux overlays) sous un nom, pour le réappliquer en un clic sur un autre tournoi — cliquez
          sur « Enregistrer » dans les deux éditeurs ci-dessous avant de sauvegarder un preset.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          className="input text-xs"
          style={{ width: "16rem" }}
          placeholder="Nom du preset (ex. Tekken - fond bleu)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="button" className="btn text-xs" disabled={saving} onClick={handleSaveAsPreset}>
          {saving ? "..." : "Enregistrer le calage actuel comme preset"}
        </button>
      </div>

      {presets.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="input text-xs"
            style={{ width: "16rem" }}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary text-xs"
            disabled={applying || !selectedId}
            onClick={handleApplyPreset}
          >
            {applying ? "..." : "Appliquer à cet event"}
          </button>
          <button
            type="button"
            className="btn text-xs"
            disabled={deleting || !selectedId}
            onClick={handleDeletePreset}
            style={{ color: "var(--lose)" }}
          >
            {deleting ? "..." : "Supprimer"}
          </button>
        </div>
      )}

      {error && (
        <span className="text-xs" style={{ color: "var(--lose)" }}>
          {error}
        </span>
      )}
      {message && !error && (
        <span className="text-xs" style={{ color: "var(--win)" }}>
          {message}
        </span>
      )}
    </div>
  );
}
