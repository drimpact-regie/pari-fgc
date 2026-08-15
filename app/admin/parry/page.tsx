import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listTournaments } from "@/lib/tournaments";
import { detectBracketReset, getCompletedSets, StartggApiError } from "@/lib/startgg";
import TournamentParryAdminSection from "@/components/TournamentParryAdminSection";

export const dynamic = "force-dynamic";

export default async function AdminParryPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const tournaments = await listTournaments();

  const sections = await Promise.all(
    tournaments.map(async (tournament) => {
      let detectedBracketReset: boolean | null = null;
      try {
        const completedSets = await getCompletedSets(tournament.eventSlug);
        detectedBracketReset = detectBracketReset(completedSets);
      } catch (err) {
        if (!(err instanceof StartggApiError)) throw err;
        // Tournoi injoignable : pas de détection auto, la saisie manuelle reste possible.
      }

      const pendingMvcBets = await prisma.mvcBet.findMany({
        where: { eventSlug: tournament.eventSlug, status: "PENDING" },
        include: { character: true },
      });
      const pendingCharacters = Array.from(
        pendingMvcBets
          .reduce((map, b) => {
            const entry = map.get(b.characterId) ?? {
              characterId: b.characterId,
              character: b.character.name,
              betCount: 0,
            };
            entry.betCount += 1;
            map.set(b.characterId, entry);
            return map;
          }, new Map<string, { characterId: string; character: string; betCount: number }>())
          .values(),
      );

      return { tournament, detectedBracketReset, pendingCharacters };
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Le Pari du Parry — Admin</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Verrous et résolutions (Top 8, MVC, reset de bracket) pour tous les tournois suivis.
        </p>
      </div>

      {sections.map(({ tournament, detectedBracketReset, pendingCharacters }) => (
        <TournamentParryAdminSection
          key={tournament.id}
          tournamentId={tournament.id}
          tournamentName={tournament.name}
          topEightLocked={tournament.topEightLocked}
          bracketResetLocked={tournament.bracketResetLocked}
          bracketResetActual={tournament.bracketResetActual}
          detectedBracketReset={detectedBracketReset}
          pendingCharacters={pendingCharacters}
        />
      ))}

      {sections.length === 0 && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Aucun tournoi suivi pour l&apos;instant.
        </p>
      )}
    </div>
  );
}
