"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PartnerInvitationalImportForm({
  eventId,
  templateUrl,
  hasMatches,
}: {
  eventId: string;
  templateUrl: string;
  hasMatches: boolean;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ created: number; updated: number; skippedLocked: number } | null>(null);

  async function doImport() {
    if (!file) {
      setError("Fichier requis (.xlsx ou .csv).");
      return;
    }
    setSaving(true);
    setError(null);
    setSummary(null);

    const formData = new FormData();
    formData.set("file", file);

    const res = await fetch(`/api/partner/invitational/events/${eventId}/import`, {
      method: "POST",
      body: formData,
    });

    setSaving(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'import.");
      return;
    }

    setFile(null);
    setSummary(data.summary ?? null);
    router.refresh();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    doImport();
  }

  return (
    <form onSubmit={submit} className="card p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold">Fichier des matchs</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Téléchargez le modèle, remplissez-le (joueurs, tags, pays — voir la légende dans le
          fichier), puis importez-le ici.
          {hasMatches && (
            <>
              {" "}Réimporter un fichier met à jour les matchs pas encore joués (noms, format, rounds)
              et ajoute les nouveaux — un match déjà en cours ou joué (score saisi, résultat déclaré)
              n&apos;est jamais modifié ni supprimé.
            </>
          )}
        </p>
      </div>
      <a href={templateUrl} className="btn w-fit" download>
        Télécharger le modèle
      </a>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="text-sm flex-1">
          Fichier rempli (.xlsx ou .csv)
          <input
            type="file"
            accept=".xlsx,.csv"
            className="input mt-1"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving || !file}>
          {saving ? "Import..." : hasMatches ? "Réimporter" : "Importer"}
        </button>
      </div>
      {summary && (
        <p className="text-xs" style={{ color: "var(--win)" }}>
          {summary.created} match{summary.created > 1 ? "s" : ""} ajouté{summary.created > 1 ? "s" : ""},{" "}
          {summary.updated} mis à jour
          {summary.skippedLocked > 0 &&
            `, ${summary.skippedLocked} déjà en cours/joué${summary.skippedLocked > 1 ? "s" : ""} (non modifié${summary.skippedLocked > 1 ? "s" : ""})`}
          .
        </p>
      )}
      {error && (
        <p className="text-sm" style={{ color: "var(--lose)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
