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
  const [confirmingReimport, setConfirmingReimport] = useState(false);

  async function doImport() {
    if (!file) {
      setError("Fichier requis (.xlsx ou .csv).");
      return;
    }
    setSaving(true);
    setError(null);
    setConfirmingReimport(false);

    const formData = new FormData();
    formData.set("file", file);

    const res = await fetch(`/api/partner/invitational/events/${eventId}/import`, {
      method: "POST",
      body: formData,
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de l'import.");
      return;
    }

    setFile(null);
    router.refresh();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (hasMatches && !confirmingReimport) {
      setConfirmingReimport(true);
      return;
    }
    doImport();
  }

  return (
    <form onSubmit={submit} className="card p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold">Fichier des matchs</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Téléchargez le modèle, remplissez-le (joueurs, tags, pays — voir la légende dans le
          fichier), puis importez-le ici.
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
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setConfirmingReimport(false);
            }}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving || !file}>
          {saving ? "Import..." : hasMatches ? "Réimporter" : "Importer"}
        </button>
      </div>
      {confirmingReimport && (
        <p className="text-xs" style={{ color: "var(--lose)" }}>
          Cet event a déjà des matchs importés : réimporter remplace entièrement les joueurs/matchs
          actuels et annule les paris déjà placés dessus. Cliquez à nouveau sur &laquo;&nbsp;Réimporter&nbsp;&raquo;
          pour confirmer.
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
