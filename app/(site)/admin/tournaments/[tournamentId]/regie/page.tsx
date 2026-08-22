import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RegieActivationPanel from "@/components/RegieActivationPanel";
import RegieStreamQueuePanel from "@/components/RegieStreamQueuePanel";

export const dynamic = "force-dynamic";

/**
 * "Mode régie" pour un tournoi start.gg (voir lib/tournamentRegie.ts) :
 * une fois activé, les 4 écrans listés ici réutilisent tels quels
 * l'admin/les overlays déjà construits pour l'Invitational (voir
 * InvitationalEvent.linkedTournamentId) — rien n'est recodé en parallèle.
 * "Match en cours en stream" et "Bracket" pointent volontairement vers le
 * même écran admin Invitational : il combine déjà la désignation du match
 * actif overlay ET la liste de tous les matchs avec leur statut, il n'y a
 * donc pas deux écrans distincts à dupliquer pour l'instant.
 */
export default async function TournamentRegiePage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const { tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { regieEvent: true },
  });
  if (!tournament) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/admin/tournaments" className="text-xs underline" style={{ color: "var(--accent)" }}>
          ← Tous les tournois
        </Link>
        <h1 className="text-xl font-semibold mt-1">Régie — {tournament.name}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Scores en direct, bracket visuel et overlays OBS pour ce tournoi. Les onglets Matchs /
          Joueurs / Top 8 / LeaderBet / Le Pari du Parry, ainsi que l&apos;économie de paris,
          restent inchangés et branchés sur start.gg en direct.
        </p>
      </div>

      <RegieActivationPanel tournamentId={tournament.id} active={Boolean(tournament.regieEvent)} />

      {tournament.regieEvent && (
        <RegieStreamQueuePanel
          eventSlug={tournament.eventSlug}
          regieEventId={tournament.regieEvent.id}
          activeOverlayMatchId={tournament.regieEvent.activeOverlayMatchId}
        />
      )}

      {tournament.regieEvent && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href={`/admin/invitational/${tournament.regieEvent.id}`} className="card p-4 hover:opacity-90">
            <p className="text-sm font-semibold">Match en cours en stream</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Désigner le match affiché en overlay, saisir le score en direct et déclarer un
              vainqueur.
            </p>
          </Link>
          <Link href={`/admin/invitational/${tournament.regieEvent.id}`} className="card p-4 hover:opacity-90">
            <p className="text-sm font-semibold">Bracket</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Liste de tous les matchs importés avec leur statut, pour naviguer et éditer
              rapidement.
            </p>
          </Link>
          <Link href={`/overlay/startgg/${tournament.id}/match`} className="card p-4 hover:opacity-90">
            <p className="text-sm font-semibold">Overlay Match en cours</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Browser Source OBS — à ajouter dans la scène du match en direct.
            </p>
          </Link>
          <Link href={`/overlay/startgg/${tournament.id}/bracket`} className="card p-4 hover:opacity-90">
            <p className="text-sm font-semibold">Overlay Bracket</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Browser Source OBS — arbre de bracket + bandeau prochains matchs/gagnants.
            </p>
          </Link>
        </div>
      )}
    </div>
  );
}
