import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RegieActivationPanel from "@/components/RegieActivationPanel";
import RegieStreamQueuePanel from "@/components/RegieStreamQueuePanel";
import TwitchChannelEditor from "@/components/TwitchChannelEditor";
import TwitchSubscribeButton from "@/components/TwitchSubscribeButton";
import DeleteTournamentButton from "@/components/DeleteTournamentButton";
import { computeChannelAuthorizationStatus, type ChannelAuthorizationStatus } from "@/lib/streamerAuthorization";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<ChannelAuthorizationStatus, { label: (botLogin: string | null) => string; color: string }> = {
  current: { label: (botLogin) => `Autorisé (${botLogin ?? "bot"})`, color: "var(--win)" },
  outdated: { label: () => "Ancien compte — à réautoriser", color: "var(--warn)" },
  unknown: { label: () => "Statut inconnu", color: "var(--muted)" },
};

/**
 * "Mode régie" pour un tournoi start.gg (voir lib/tournamentRegie.ts) :
 * une fois activé, les écrans listés ici réutilisent tels quels
 * l'admin/les overlays déjà construits pour l'Invitational (voir
 * InvitationalEvent.linkedTournamentId) — rien n'est recodé en parallèle.
 * Centralise aussi les réglages propres à CE tournoi (chaîne Twitch,
 * autorisation bot, chat betting, suppression) — auparavant dans le
 * tableau de /admin/tournaments, déplacés ici pour que cette page soit le
 * point d'entrée unique "gérer ce tournoi".
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

  const botToken = await prisma.twitchBotToken.findUnique({ where: { id: "singleton" } });
  const authorization = tournament.twitchChannel
    ? await prisma.streamerChannelAuthorization.findUnique({
        where: { twitchLogin: tournament.twitchChannel.toLowerCase() },
      })
    : null;
  const authStatus = tournament.twitchChannel
    ? computeChannelAuthorizationStatus(authorization, botToken?.login ?? null)
    : "unknown";
  const badge = STATUS_BADGE[authStatus];

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

      <div className="card p-4 flex flex-col gap-3">
        <p className="text-sm font-semibold">Chaîne Twitch (pari via chat)</p>
        <TwitchChannelEditor tournamentId={tournament.id} initialChannel={tournament.twitchChannel} />
        {tournament.twitchChannel && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs" style={{ color: badge.color }}>
              {badge.label(botToken?.login ?? null)}
            </span>
            <TwitchSubscribeButton tournamentId={tournament.id} active={Boolean(tournament.twitchSubscriptionId)} />
          </div>
        )}
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
            <p className="text-sm font-semibold">Bracket</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Liste de tous les matchs importés avec leur statut, pour naviguer et éditer
              rapidement.
            </p>
          </Link>
          <Link
            href={`/admin/invitational/${tournament.regieEvent.id}?tab=overlay`}
            className="card p-4 hover:opacity-90"
          >
            <p className="text-sm font-semibold">Calcage overlay</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Fond, positions et tailles des éléments affichés en overlay.
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

      <div className="card p-4 flex items-center justify-between gap-3">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Supprimer ce tournoi retire son accès depuis le site (les paris déjà placés restent en
          base).
        </p>
        <DeleteTournamentButton tournamentId={tournament.id} tournamentName={tournament.name} />
      </div>
    </div>
  );
}
