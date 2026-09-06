import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AddAuthorizedStreamerForm from "@/components/AddAuthorizedStreamerForm";
import RemoveAuthorizedStreamerButton from "@/components/RemoveAuthorizedStreamerButton";

export const dynamic = "force-dynamic";

/**
 * "Les streameurs" — liste blanche des chaînes Twitch autorisées à
 * accéder à l'espace streamer/régie (impactobot.fr, voir
 * lib/streamerAuthorization.ts), avec pour chacune ses tournois/events en
 * cours : point d'entrée unique pour un admin qui veut aller aider
 * n'importe quel streamer sans avoir à chercher dans les listes séparées
 * Tournois/Invitational. Autoriser une chaîne ici ne donne accès que si la
 * personne se connecte ensuite AVEC ce compte Twitch (ou en a déjà un
 * lié) : "Compte site" ci-dessous indique si c'est déjà le cas.
 */
export default async function AdminStreamersPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const streamers = await prisma.authorizedStreamer.findMany({ orderBy: { createdAt: "desc" } });
  const linkedUsers = await prisma.user.findMany({
    where: { twitchId: { in: streamers.map((s) => s.twitchUserId) } },
    select: { id: true, twitchId: true, username: true },
  });
  const linkedUserByTwitchId = new Map(linkedUsers.map((u) => [u.twitchId, u]));

  const [tournaments, invitationalEvents] = await Promise.all([
    prisma.tournament.findMany({
      where: { twitchChannel: { not: null } },
      select: { id: true, name: true, twitchChannel: true },
    }),
    prisma.invitationalEvent.findMany({
      where: { ownerUserId: { in: linkedUsers.map((u) => u.id) }, linkedTournamentId: null },
      select: { id: true, name: true, ownerUserId: true },
    }),
  ]);
  const tournamentsByChannel = new Map<string, typeof tournaments>();
  for (const t of tournaments) {
    const channel = t.twitchChannel!.toLowerCase();
    if (!tournamentsByChannel.has(channel)) tournamentsByChannel.set(channel, []);
    tournamentsByChannel.get(channel)!.push(t);
  }
  const invitationalByOwner = new Map<string, typeof invitationalEvents>();
  for (const e of invitationalEvents) {
    if (!e.ownerUserId) continue;
    if (!invitationalByOwner.has(e.ownerUserId)) invitationalByOwner.set(e.ownerUserId, []);
    invitationalByOwner.get(e.ownerUserId)!.push(e);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Les streameurs</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Seuls les admins et les chaînes Twitch listées ici peuvent accéder à l&apos;espace
          streamer/régie (impactobot.fr) une fois connectés avec ce compte Twitch.
        </p>
      </div>

      <AddAuthorizedStreamerForm />

      {streamers.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Aucune chaîne autorisée pour l&apos;instant.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {streamers.map((s) => {
            const linkedUser = linkedUserByTwitchId.get(s.twitchUserId);
            const regieTournaments = tournamentsByChannel.get(s.twitchLogin) ?? [];
            const ownedEvents = linkedUser ? invitationalByOwner.get(linkedUser.id) ?? [] : [];

            return (
              <div key={s.id} className="card p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={`https://www.twitch.tv/${s.twitchLogin}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold underline"
                    style={{ color: "var(--accent)" }}
                  >
                    {s.displayName}
                  </a>
                  <RemoveAuthorizedStreamerButton streamerId={s.id} displayName={s.displayName} />
                </div>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {linkedUser ? (
                    <span style={{ color: "var(--win)" }}>Compte lié ({linkedUser.username})</span>
                  ) : (
                    "Pas encore connecté via Twitch"
                  )}
                </p>
                {(regieTournaments.length > 0 || ownedEvents.length > 0) && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {regieTournaments.map((t) => (
                      <Link
                        key={t.id}
                        href={`/admin/tournaments/${t.id}/regie`}
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: "var(--surface-alt)", color: "var(--muted)" }}
                      >
                        🎮 {t.name}
                      </Link>
                    ))}
                    {ownedEvents.map((e) => (
                      <Link
                        key={e.id}
                        href={`/admin/invitational/${e.id}`}
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: "var(--surface-alt)", color: "var(--muted)" }}
                      >
                        🏆 {e.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
