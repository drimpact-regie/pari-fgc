import { notFound } from "next/navigation";

import { getTournament, listTournaments } from "@/lib/tournaments";
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

  return (
    <div className="flex flex-col gap-4">
      <TournamentNav
        tournaments={tournaments.map((t) => ({ id: t.id, name: t.name }))}
        currentId={tournamentId}
      />
      <h1 className="text-xl font-semibold -mb-2">{tournament.name}</h1>
      {children}
    </div>
  );
}
