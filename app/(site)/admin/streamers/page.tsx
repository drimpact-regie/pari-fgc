import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AddAuthorizedStreamerForm from "@/components/AddAuthorizedStreamerForm";
import RemoveAuthorizedStreamerButton from "@/components/RemoveAuthorizedStreamerButton";

export const dynamic = "force-dynamic";

/**
 * Liste blanche des chaînes Twitch autorisées à accéder à l'espace
 * streamer/régie (impactobot.fr) — voir lib/streamerAuthorization.ts.
 * Autoriser une chaîne ici ne donne accès que si la personne se connecte
 * ensuite AVEC ce compte Twitch (ou en a déjà un lié) : "Compte site" ci-
 * dessous indique si c'est déjà le cas.
 */
export default async function AdminStreamersPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const streamers = await prisma.authorizedStreamer.findMany({ orderBy: { createdAt: "desc" } });
  const linkedUsers = await prisma.user.findMany({
    where: { twitchId: { in: streamers.map((s) => s.twitchUserId) } },
    select: { twitchId: true, username: true },
  });
  const usernameByTwitchId = new Map(linkedUsers.map((u) => [u.twitchId, u.username]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Streamers autorisés</h1>
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
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-4 py-2 font-medium">Chaîne Twitch</th>
                <th className="px-4 py-2 font-medium">Compte site</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {streamers.map((s) => {
                const linkedUsername = usernameByTwitchId.get(s.twitchUserId);
                return (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-4 py-2">
                      <a
                        href={`https://www.twitch.tv/${s.twitchLogin}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                        style={{ color: "var(--accent)" }}
                      >
                        {s.displayName}
                      </a>
                    </td>
                    <td className="px-4 py-2">
                      {linkedUsername ? (
                        <span style={{ color: "var(--win)" }}>Lié ({linkedUsername})</span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>
                          Pas encore connecté via Twitch
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <RemoveAuthorizedStreamerButton streamerId={s.id} displayName={s.displayName} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
