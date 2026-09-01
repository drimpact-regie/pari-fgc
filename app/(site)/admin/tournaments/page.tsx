import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listTournaments } from "@/lib/tournaments";
import { getEventInfo, tournamentSlugFromEventSlug } from "@/lib/startgg";
import AddTournamentForm from "@/components/AddTournamentForm";
import BulkImportTournamentsForm from "@/components/BulkImportTournamentsForm";
import SyncResultsButton from "@/components/SyncResultsButton";

export const dynamic = "force-dynamic";

interface TournamentCard {
  id: string;
  name: string;
  bannerUrl: string | null;
  videogameImageUrl: string | null;
}

interface TournamentGroup {
  rootSlug: string;
  label: string;
  bannerUrl: string | null;
  cards: TournamentCard[];
}

function TournamentBannerCard({ tournament }: { tournament: TournamentCard }) {
  return (
    <Link
      href={`/admin/tournaments/${tournament.id}/regie`}
      className="card relative flex items-end overflow-hidden hover:opacity-90"
      style={{
        height: "8rem",
        backgroundImage: tournament.bannerUrl
          ? `linear-gradient(rgba(11,13,18,0.15), rgba(11,13,18,0.9)), url(${tournament.bannerUrl})`
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {tournament.videogameImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tournament.videogameImageUrl}
          alt=""
          className="absolute top-3 right-3 rounded-md object-cover"
          style={{ width: "3rem", height: "3rem", boxShadow: "0 0 0 2px rgba(255,255,255,0.2)" }}
        />
      )}
      <span className="font-semibold text-lg p-4 drop-shadow">{tournament.name}</span>
    </Link>
  );
}

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

  const eventInfos = await Promise.all(
    sorted.map((t) => getEventInfo(t.eventSlug).catch(() => null)),
  );

  // Regroupe les tournois qui partagent la même racine start.gg (un tournoi
  // multi-jeux type "Ultimate Fighting Arena" importe chaque jeu comme un
  // Tournament séparé, voir BulkImportTournamentsForm — mais ils restent
  // rattachés au même événement "parent") — dans l'ordre de première
  // apparition, donc du groupe le plus récent au plus ancien puisque
  // `sorted` est déjà trié plus-récent-d'abord.
  const groups: TournamentGroup[] = [];
  const groupByRoot = new Map<string, TournamentGroup>();
  for (let i = 0; i < sorted.length; i++) {
    const rootSlug = tournamentSlugFromEventSlug(sorted[i].eventSlug);
    let group = groupByRoot.get(rootSlug);
    if (!group) {
      group = {
        rootSlug,
        label: eventInfos[i]?.tournamentName || sorted[i].name,
        bannerUrl: eventInfos[i]?.bannerUrl ?? null,
        cards: [],
      };
      groupByRoot.set(rootSlug, group);
      groups.push(group);
    }
    group.cards.push({
      id: sorted[i].id,
      name: sorted[i].name,
      bannerUrl: eventInfos[i]?.bannerUrl ?? null,
      videogameImageUrl: eventInfos[i]?.videogameImageUrl ?? null,
    });
  }

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
        {groups.map((group) =>
          group.cards.length === 1 ? (
            <TournamentBannerCard key={group.rootSlug} tournament={group.cards[0]} />
          ) : (
            <details key={group.rootSlug} className="card overflow-hidden" open>
              <summary
                className="px-4 py-3 cursor-pointer font-semibold text-lg flex items-center justify-between gap-3"
                style={{
                  backgroundImage: group.bannerUrl
                    ? `linear-gradient(rgba(11,13,18,0.55), rgba(11,13,18,0.85)), url(${group.bannerUrl})`
                    : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <span className="drop-shadow">{group.label}</span>
                <span className="text-xs font-normal whitespace-nowrap" style={{ color: "var(--muted)" }}>
                  {group.cards.length} jeux
                </span>
              </summary>
              <div className="flex flex-col gap-3 p-3">
                {group.cards.map((card) => (
                  <TournamentBannerCard key={card.id} tournament={card} />
                ))}
              </div>
            </details>
          ),
        )}
      </div>

      <AddTournamentForm />
      <BulkImportTournamentsForm />
    </div>
  );
}
