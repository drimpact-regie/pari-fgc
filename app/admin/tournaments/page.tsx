import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listTournaments } from "@/lib/tournaments";
import AddTournamentForm from "@/components/AddTournamentForm";
import TwitchChannelEditor from "@/components/TwitchChannelEditor";
import TwitchSubscribeButton from "@/components/TwitchSubscribeButton";

export const dynamic = "force-dynamic";

export default async function AdminTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ twitchConnected?: string; twitchError?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const { twitchConnected, twitchError } = await searchParams;
  const tournaments = await listTournaments();
  const botToken = await prisma.twitchBotToken.findUnique({ where: { id: "singleton" } });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Gérer les tournois</h1>

      {twitchConnected && (
        <div className="card p-4 text-sm" style={{ color: "var(--win)" }}>
          Bot Twitch connecté avec succès.
        </div>
      )}
      {twitchError && (
        <div className="card p-4 text-sm" style={{ color: "var(--lose)" }}>
          Erreur Twitch : {decodeURIComponent(twitchError)}
        </div>
      )}

      <div className="card p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Bot Twitch (pari via chat)</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            {botToken
              ? `Connecté en tant que ${botToken.login}`
              : "Aucun bot connecté — le pari via chat ne fonctionnera pas tant que ce n'est pas fait."}
          </p>
        </div>
        <a href="/api/admin/twitch/connect" className="btn btn-primary text-xs">
          {botToken ? "Reconnecter" : "Connecter le bot Twitch"}
        </a>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left"
              style={{ background: "var(--surface-alt)", color: "var(--muted)" }}
            >
              <th className="px-4 py-2 font-medium">Nom</th>
              <th className="px-4 py-2 font-medium">Slug start.gg</th>
              <th className="px-4 py-2 font-medium">Chaîne Twitch</th>
              <th className="px-4 py-2 font-medium">Chat betting</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {tournaments.map((t) => (
              <tr key={t.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-2 font-medium">{t.name}</td>
                <td className="px-4 py-2 font-mono text-xs" style={{ color: "var(--muted)" }}>
                  {t.eventSlug}
                </td>
                <td className="px-4 py-2">
                  <TwitchChannelEditor tournamentId={t.id} initialChannel={t.twitchChannel} />
                </td>
                <td className="px-4 py-2">
                  {t.twitchChannel ? (
                    <TwitchSubscribeButton
                      tournamentId={t.id}
                      active={Boolean(t.twitchSubscriptionId)}
                    />
                  ) : (
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      Renseignez une chaîne d&apos;abord
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/t/${t.id}/matches`} className="underline" style={{ color: "var(--accent)" }}>
                    Voir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddTournamentForm />
    </div>
  );
}
