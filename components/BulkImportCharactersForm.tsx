"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Import groupé du roster d'un jeu, un tournoi/jeu à la fois — plutôt que
 * d'ajouter chaque personnage un par un via AddCharacterForm (pénible pour
 * un roster de 30-50 personnages). Le tournoi est choisi dans une liste
 * déroulante plutôt que le jeu tapé à la main : le nom exact du jeu est
 * résolu côté serveur depuis start.gg (voir /api/admin/characters/bulk-import),
 * pour ne jamais risquer une faute de frappe qui romprait le matching.
 */
export default function BulkImportCharactersForm({
  tournaments,
}: {
  tournaments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [tournamentId, setTournamentId] = useState(tournaments[0]?.id ?? "");
  const [namesText, setNamesText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ game: string; imported: number } | null>(null);

  if (tournaments.length === 0) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const names = namesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (names.length === 0) {
      setError("Colle au moins un nom de personnage (un par ligne).");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/admin/characters/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId, names }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'import.");
      return;
    }

    setResult(data);
    setNamesText("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold">Importer le roster d&apos;un jeu</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Choisis le tournoi correspondant (le jeu est déduit automatiquement de start.gg), colle
          la liste des personnages — un par ligne — puis importe. Les personnages déjà présents
          (et leur image déjà renseignée) ne sont jamais écrasés.
        </p>
      </div>

      <label className="text-sm">
        Tournoi (détermine le jeu)
        <select
          className="input mt-1"
          value={tournamentId}
          onChange={(e) => setTournamentId(e.target.value)}
        >
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        Personnages (un par ligne)
        <textarea
          className="input mt-1"
          value={namesText}
          onChange={(e) => setNamesText(e.target.value)}
          rows={6}
          placeholder={"Ryu\nChun-Li\nKen\n..."}
        />
      </label>

      {error && (
        <p className="text-sm" style={{ color: "var(--lose)" }}>
          {error}
        </p>
      )}
      {result && (
        <p className="text-sm" style={{ color: "var(--win)" }}>
          {result.imported} personnage{result.imported > 1 ? "s" : ""} importé
          {result.imported > 1 ? "s" : ""} pour {result.game}.
        </p>
      )}

      <button type="submit" className="btn btn-primary self-start" disabled={loading}>
        {loading ? "Import..." : "Importer le roster"}
      </button>
    </form>
  );
}
