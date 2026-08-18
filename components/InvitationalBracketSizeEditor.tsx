"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { BRACKET_SIZES, type BracketSize } from "@/lib/invitationalBracketTemplate";

/**
 * Sélection de la taille du bracket (8/16/32, voir Partie 2 du prompt
 * overlay bracket) : détermine le gabarit de colonnes/cases affiché sur
 * l'overlay OBS (lib/invitationalBracketTemplate.ts) — les matchs déjà
 * importés viennent s'y ranger automatiquement (par groupLabel/orderIndex,
 * même logique que le regroupement déjà utilisé ailleurs), pas de
 * ressaisie manuelle. Tant qu'aucune taille n'est choisie, l'overlay garde
 * son ancien rendu (une colonne par groupe rencontré, sans gabarit ni
 * lignes de connexion) pour ne rien casser sur les events déjà en cours.
 */
export default function InvitationalBracketSizeEditor({
  eventId,
  initialSize,
}: {
  eventId: string;
  initialSize: number | null;
}) {
  const router = useRouter();
  const [size, setSize] = useState<number | null>(initialSize);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function selectSize(value: BracketSize) {
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/admin/invitational/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bracketSize: value }),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de l'enregistrement.");
      return;
    }
    setSize(value);
    router.refresh();
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold">Taille du bracket</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Détermine le gabarit de colonnes affiché sur l&apos;overlay OBS (arbre visuel avec lignes
          de connexion). Les matchs déjà importés s&apos;y rangent automatiquement.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {BRACKET_SIZES.map((s) => (
          <button
            key={s}
            type="button"
            className={size === s ? "btn btn-primary text-xs" : "btn text-xs"}
            disabled={saving}
            onClick={() => selectSize(s)}
          >
            {s} joueurs
          </button>
        ))}
      </div>
      {error && (
        <span className="text-xs" style={{ color: "var(--lose)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
