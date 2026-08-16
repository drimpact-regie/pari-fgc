"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddInvitationalEventForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Fichier requis (.xlsx ou .csv).");
      return;
    }
    setSaving(true);
    setError(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("eventDate", eventDate);
    formData.set("file", file);

    const res = await fetch("/api/admin/invitational/events", {
      method: "POST",
      body: formData,
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de l'import.");
      return;
    }

    setName("");
    setEventDate("");
    setFile(null);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold">Créer un event</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Le format (bracket, round robin, swiss, pools, liste simple) et la structure des matchs
          sont entièrement déduits du fichier importé — voir{" "}
          <code className="text-xs">docs/invitational-import-format.md</code> pour la structure de
          fichier attendue.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="text-sm flex-1">
          Nom de l&apos;event
          <input
            className="input mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Showmatch RZA vs Sonicfox"
            required
          />
        </label>
        <label className="text-sm">
          Date
          <input
            type="date"
            className="input mt-1"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
          />
        </label>
        <label className="text-sm flex-1">
          Fichier (.xlsx ou .csv)
          <input
            type="file"
            accept=".xlsx,.csv"
            className="input mt-1"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Import..." : "Importer"}
        </button>
      </div>
      {error && (
        <p className="text-sm" style={{ color: "var(--lose)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
