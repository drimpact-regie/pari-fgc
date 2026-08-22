import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ADMIN_SECTIONS = [
  { href: "/admin/tournaments", label: "Tournois", description: "Gérer les tournois start.gg, le bot Twitch et le mode régie." },
  { href: "/admin/invitational", label: "Invitational / Prestataire", description: "Créer et gérer les events Invitational/Prestataire." },
  { href: "/admin/characters", label: "Personnages", description: "Rosters de personnages par jeu, pour le Pari du Parry." },
  { href: "/admin/parry", label: "Le Pari du Parry", description: "Verrous et résolutions MVC/reset de bracket pour tous les tournois." },
  { href: "/admin/ex", label: "Soldes Ex", description: "Ajustements manuels et historique des soldes Ex des comptes." },
  { href: "/admin/streamers", label: "Les streameurs", description: "Chaînes Twitch autorisées sur impactobot.fr et leurs events." },
] as const;

/**
 * Page d'accueil de l'administration — un bouton par section, plutôt que de
 * n'exposer ces pages qu'au travers du menu déroulant "Admin" de la nav
 * (toujours disponible aussi, voir Nav.tsx).
 */
export default async function AdminHomePage() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Administration</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Toutes les sections admin du site.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ADMIN_SECTIONS.map((section) => (
          <Link key={section.href} href={section.href} className="card p-4 hover:opacity-90">
            <p className="text-sm font-semibold">{section.label}</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              {section.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
