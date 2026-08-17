import { listTournaments } from "@/lib/tournaments";
import TournamentNav from "@/components/TournamentNav";

export default async function InvitationalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tournaments = await listTournaments();

  return (
    <div className="flex flex-col gap-4">
      <TournamentNav
        tournaments={tournaments.map((t) => ({ id: t.id, name: t.name }))}
        currentId={null}
      />
      {children}
    </div>
  );
}
