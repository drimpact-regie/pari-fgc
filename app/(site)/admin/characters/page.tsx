import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CharacterImageRow from "@/components/CharacterImageRow";
import AddCharacterForm from "@/components/AddCharacterForm";
import BulkImportCharactersForm from "@/components/BulkImportCharactersForm";
import ImportTekken8Button from "@/components/ImportTekken8Button";
import { listTournaments } from "@/lib/tournaments";
import { TEKKEN8_GAME_NAME } from "@/lib/tekken8Roster";

export const dynamic = "force-dynamic";

export default async function AdminCharactersPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const { game: gameParam } = await searchParams;

  const gameRows = await prisma.character.findMany({
    distinct: ["game"],
    select: { game: true },
    orderBy: { game: "asc" },
  });
  const games = gameRows.map((g) => g.game);
  const selectedGame = gameParam || games[0] || "";

  const characters = selectedGame
    ? await prisma.character.findMany({
        where: { game: selectedGame },
        orderBy: { name: "asc" },
      })
    : [];

  const tournaments = await listTournaments();
  const tournamentOptions = [...tournaments].reverse().map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Personnages</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Colle l&apos;URL d&apos;une image par personnage (clic droit → copier l&apos;adresse de
          l&apos;image, depuis start.gg ou le site officiel du jeu). L&apos;avatar coloré reste
          affiché tant qu&apos;aucune image valide n&apos;est renseignée.
        </p>
      </div>

      {!games.includes(TEKKEN8_GAME_NAME) && <ImportTekken8Button />}

      {games.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {games.map((g) => (
            <Link
              key={g}
              href={`/admin/characters?game=${encodeURIComponent(g)}`}
              className="px-3 py-1.5 rounded-md text-sm whitespace-nowrap"
              style={
                g === selectedGame
                  ? { background: "var(--accent)", color: "#0b0d12", fontWeight: 600 }
                  : { background: "var(--surface-alt)", color: "var(--foreground)" }
              }
            >
              {g}
            </Link>
          ))}
        </div>
      )}

      {selectedGame ? (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left"
                style={{ background: "var(--surface-alt)", color: "var(--muted)" }}
              >
                <th className="px-4 py-2 font-medium"></th>
                <th className="px-4 py-2 font-medium">Nom</th>
                <th className="px-4 py-2 font-medium">URL de l&apos;image</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {characters.map((c) => (
                <CharacterImageRow key={c.id} character={c} />
              ))}
            </tbody>
          </table>
          {characters.length === 0 && (
            <p className="p-4 text-sm" style={{ color: "var(--muted)" }}>
              Aucun personnage pour ce jeu.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Aucun roster pour l&apos;instant — ajoute un premier personnage ci-dessous (le jeu sera
          créé automatiquement).
        </p>
      )}

      <AddCharacterForm defaultGame={selectedGame} />
      <BulkImportCharactersForm tournaments={tournamentOptions} />
    </div>
  );
}
