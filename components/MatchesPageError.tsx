"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Bannière d'erreur avec un "Réessayer" explicite, plutôt qu'un simple
 * texte rouge sans action claire — repéré en conditions réelles sur un
 * tournoi à ~25 jeux, où l'API start.gg répond régulièrement 429 (débit
 * partagé sur un seul token entre tous les jeux) malgré les tentatives
 * automatiques déjà faites par callStartGG (lib/startgg.ts).
 *
 * router.refresh() relance le rendu serveur de cette page (donc un nouvel
 * appel start.gg) sans recharger tout le document — enveloppé dans
 * startTransition (plutôt qu'un état "loading" géré à la main) pour que
 * `isPending` retombe correctement à false une fois le nouveau rendu
 * appliqué, MÊME si le nouveau rendu échoue à nouveau avec le même message
 * d'erreur (un état local géré à la main resterait sinon bloqué sur
 * "..." indéfiniment dans ce cas, ce composant n'étant pas remonté).
 */
export default function MatchesPageError({ message }: { message: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="card p-4 flex items-center justify-between gap-3" style={{ color: "var(--lose)" }}>
      <span>Impossible de récupérer les matchs depuis start.gg : {message}</span>
      <button
        type="button"
        className="btn text-xs shrink-0"
        disabled={isPending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {isPending ? "..." : "Réessayer"}
      </button>
    </div>
  );
}
