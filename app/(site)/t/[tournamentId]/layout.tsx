import { Suspense } from "react";
import { notFound } from "next/navigation";

import { getTournament, listTournaments } from "@/lib/tournaments";
import { getEventInfo } from "@/lib/startgg";
import TournamentNav from "@/components/TournamentNav";
import TwitchEmbed from "@/components/TwitchEmbed";

// Streamée à part (Suspense) : un appel start.gg lent ou rate-limité ne doit
// pas bloquer l'affichage du tournoi pour une image de fond purement décorative.
async function TournamentBanner({ eventSlug }: { eventSlug: string }) {
  // La bannière est un bonus purement visuel : on l'ignore silencieusement
  // si start.gg est indisponible plutôt que de casser la page.
  const bannerUrl = await getEventInfo(eventSlug)
    .then((info) => info?.bannerUrl ?? null)
    .catch(() => null);
  if (!bannerUrl) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10"
      style={{
        backgroundImage: `linear-gradient(rgba(11,13,18,0.82), rgba(11,13,18,0.96)), url(${bannerUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    />
  );
}

export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const [tournament, tournaments] = await Promise.all([
    getTournament(tournamentId),
    listTournaments(),
  ]);

  if (!tournament) notFound();

  return (
    <>
      <Suspense fallback={null}>
        <TournamentBanner eventSlug={tournament.eventSlug} />
      </Suspense>
      <div className="flex flex-col gap-4">
        <TournamentNav
          tournaments={tournaments.map((t) => ({ id: t.id, name: t.name }))}
          currentId={tournamentId}
        />
        <h1 className="text-xl font-semibold -mb-2">{tournament.name}</h1>
        {children}
        {tournament.twitchChannel && <TwitchEmbed channel={tournament.twitchChannel} />}
      </div>
    </>
  );
}
