"use client";

import { useState } from "react";

interface ResyncTarget {
  id: string;
  name: string;
}

interface ResyncResult {
  name: string;
  ok: boolean;
  message?: string;
}

/**
 * Resynchronise en un clic tous les jeux d'un même tournoi multi-jeux (ex.
 * "Ultimate Fighting Arena", ~24 jeux) plutôt que d'entrer dans chaque page
 * de régie un par un et cliquer "Resynchroniser" à chaque fois.
 *
 * Boucle SÉQUENTIELLE côté navigateur sur la route de resync existante
 * (une par jeu), plutôt qu'une seule route serveur qui ferait tout en un
 * appel : une resync régie peut à elle seule déclencher jusqu'à une
 * dizaine de requêtes start.gg (voir lib/tournamentRegie.ts) — les
 * lancer TOUTES en parallèle pour ~24 jeux dépasserait vite le budget de
 * débit start.gg (voir le correctif 429 de callStartGG), et un unique
 * appel serveur qui boucle sur tout risquerait en plus le timeout d'une
 * fonction serverless. Cette boucle séquentielle affiche aussi une
 * progression lisible ("3/24") plutôt qu'une attente silencieuse.
 */
export default function BulkResyncRegieButton({ targets }: { targets: ResyncTarget[] }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ResyncResult[] | null>(null);

  if (targets.length === 0) return null;

  async function run() {
    setRunning(true);
    setResults(null);
    setProgress(0);
    const collected: ResyncResult[] = [];
    for (const target of targets) {
      try {
        const res = await fetch(`/api/admin/tournaments/${target.id}/regie/resync`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        collected.push({ name: target.name, ok: res.ok, message: res.ok ? undefined : data.error });
      } catch {
        collected.push({ name: target.name, ok: false, message: "Erreur réseau." });
      }
      setProgress((p) => p + 1);
      setResults([...collected]);
    }
    setRunning(false);
  }

  const errorCount = results?.filter((r) => !r.ok).length ?? 0;

  return (
    <div className="flex flex-col gap-2">
      <button type="button" className="btn text-xs self-start" disabled={running} onClick={run}>
        {running ? `Rechargement... (${progress}/${targets.length})` : `Recharger tous les jeux (${targets.length})`}
      </button>
      {results && !running && (
        <p className="text-xs" style={{ color: errorCount > 0 ? "var(--lose)" : "var(--win)" }}>
          {results.length - errorCount}/{results.length} jeux resynchronisés
          {errorCount > 0 ? `, ${errorCount} en échec` : ""}.
        </p>
      )}
      {results && errorCount > 0 && (
        <ul className="text-xs flex flex-col gap-1">
          {results
            .filter((r) => !r.ok)
            .map((r) => (
              <li key={r.name} style={{ color: "var(--lose)" }}>
                {r.name} — {r.message ?? "Erreur inconnue."}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
