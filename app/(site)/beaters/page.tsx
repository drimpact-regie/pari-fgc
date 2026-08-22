import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * "Les Beaters" : liste de tous les comptes inscrits sur le site (pas les
 * inscrits d'un tournoi start.gg) — sert à voir le nombre de joueurs qui
 * parient sur Impact'O Bet, tous tournois confondus. Site-wide (pas
 * rattaché à un tournoi précis), voir le lien dans components/Nav.tsx.
 */
export default async function BeatersPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?from=%2Fbeaters");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true, createdAt: true },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Les Beaters</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Tous les comptes inscrits sur Impact&apos;O Bet, du plus récent au plus ancien.
        </p>
      </div>

      <div className="card p-4">
        <p className="text-sm font-semibold mb-3">
          {users.length} joueur{users.length > 1 ? "s" : ""} inscrit{users.length > 1 ? "s" : ""}
        </p>
        {users.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Aucun inscrit pour le moment.
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {users.map((user) => (
              <li
                key={user.id}
                className="text-sm px-3 py-2 rounded-md"
                style={{ background: "var(--surface-alt)" }}
              >
                {user.username}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
