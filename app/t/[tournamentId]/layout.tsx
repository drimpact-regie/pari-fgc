import { notFound } from "next/navigation";

import { getTournament, listTournaments } from "@/lib/tournaments";
import { getEventInfo } from "@/lib/startgg";
import TournamentNav from "@/components/TournamentNav";

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

  // La bannière est un bonus purement visuel : on l'ignore silencieusement
  // si start.gg est indisponible plutôt que de casser la page.
  const bannerUrl = await getEventInfo(tournament.eventSlug)
    .then((info) => info?.bannerUrl ?? null)
    .catch(() => null);

  return (
    <>
      {bannerUrl && (
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
      )}
      <div className="flex flex-col gap-4">
        <TournamentNav
          tournaments={tournaments.map((t) => ({ id: t.id, name: t.name }))}
          currentId={tournamentId}
        />
        <h1 className="text-xl font-semibold -mb-2">{tournament.name}</h1>
        {children}
      </div>
    </>
  );
}
