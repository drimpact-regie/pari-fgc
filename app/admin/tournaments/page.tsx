import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listTournaments } from "@/lib/tournaments";
import AddTournamentForm from "@/components/AddTournamentForm";

export const dynamic = "force-dynamic";

export default async function AdminTournamentsPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const tournaments = await listTournaments();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Gérer les tournois</h1>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left"
              style={{ background: "var(--surface-alt)", color: "var(--muted)" }}
            >
              <th className="px-4 py-2 font-medium">Nom</th>
              <th className="px-4 py-2 font-medium">Slug start.gg</th>
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
