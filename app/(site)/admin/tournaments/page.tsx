import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listTournaments } from "@/lib/tournaments";
import { getEventInfo } from "@/lib/startgg";
import AddTournamentForm from "@/components/AddTournamentForm";
import BulkImportTournamentsForm from "@/components/BulkImportTournamentsForm";
import SyncResultsButton from "@/components/SyncResultsButton";

export const dynamic = "force-dynamic";

/**
 * Liste des tournois façon bannières (même style que l'accueil parieur,
 * voir app/(site)/page.tsx) — cliquer sur un tournoi mène à sa page de
 * régie ("Gérer le tournoi"), qui centralise désormais les réglages
 * propres à CE tournoi (chaîne Twitch, autorisation bot, chat betting,
 * suppression — voir la page régie).
 */
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
  const sorted = [...tournaments].reverse(); // plus récent d'abord

  const bannerUrls = await Promise.all(
    sorted.map((t) =>
      getEventInfo(t.eventSlug)
        .then((info) => info?.bannerUrl ?? null)
        .catch(() => null),
    ),
  );

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

      <SyncResultsButton />

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

      <div className="flex flex-col gap-3">
        {sorted.map((t, i) => {
          const bannerUrl = bannerUrls[i];
          return (
            <Link
              key={t.id}
              href={`/admin/tournaments/${t.id}/regie`}
              className="card relative flex items-end overflow-hidden hover:opacity-90"
              style={{
                height: "8rem",
                backgroundImage: bannerUrl
                  ? `linear-gradient(rgba(11,13,18,0.15), rgba(11,13,18,0.9)), url(${bannerUrl})`
                  : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <span className="font-semibold text-lg p-4 drop-shadow">{t.name}</span>
            </Link>
          );
        })}
      </div>

      <AddTournamentForm />
      <BulkImportTournamentsForm />
    </div>
  );
}
