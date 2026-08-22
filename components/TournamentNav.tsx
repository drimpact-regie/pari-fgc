"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface TournamentSummary {
  id: string;
  name: string;
}

const SECTIONS = [
  { slug: "beaters", label: "Les Beaters" },
  { slug: "matches", label: "Matchs" },
  { slug: "players", label: "Joueurs" },
  { slug: "top8", label: "Top 8" },
  { slug: "leaderboard", label: "LeaderBet" },
  { slug: "parry", label: "Le Pari du Parry" },
] as const;

const INVITATIONAL_SECTIONS = [
  { slug: "", label: "Events" },
  { slug: "leaderboard", label: "LeaderBet Invitational" },
] as const;

/**
 * `currentId` vaut `null` quand on est dans la section Invitational /
 * Prestataire (voir app/invitational/layout.tsx) — cette section n'a pas de
 * tournoi start.gg associé, mais partage la même rangée de pastilles
 * (tournois + pastille "Invitational / Prestataire" toujours présente en
 * dernier) pour rester "au même niveau" que les tournois classiques.
 */
export default function TournamentNav({
  tournaments,
  currentId,
}: {
  tournaments: TournamentSummary[];
  currentId: string | null;
}) {
  const pathname = usePathname();
  const inInvitational = currentId === null;
  const tournamentSection =
    SECTIONS.find((s) => pathname.endsWith(`/${s.slug}`))?.slug ?? "matches";
  const invitationalSection = pathname.endsWith("/leaderboard") ? "leaderboard" : "";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tournaments.map((t) => (
          <Link
            key={t.id}
            href={`/t/${t.id}/${tournamentSection}`}
            className="px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors"
            style={
              !inInvitational && t.id === currentId
                ? { background: "var(--accent)", color: "#0b0d12", fontWeight: 600 }
                : { background: "var(--surface-alt)", color: "var(--foreground)" }
            }
          >
            {t.name}
          </Link>
        ))}
        <Link
          href="/invitational"
          className="px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors"
          style={
            inInvitational
              ? { background: "var(--accent)", color: "#0b0d12", fontWeight: 600 }
              : { background: "var(--surface-alt)", color: "var(--foreground)" }
          }
        >
          Invitational / Prestataire
        </Link>
      </div>

      <nav className="flex gap-4 text-sm border-b pb-2" style={{ borderColor: "var(--border)" }}>
        {inInvitational
          ? INVITATIONAL_SECTIONS.map((section) => (
              <Link
                key={section.slug}
                href={`/invitational${section.slug ? `/${section.slug}` : ""}`}
                className="hover:opacity-80"
                style={
                  invitationalSection === section.slug
                    ? { color: "var(--accent)", fontWeight: 600 }
                    : undefined
                }
              >
                {section.label}
              </Link>
            ))
          : SECTIONS.map((section) => (
              <Link
                key={section.slug}
                href={`/t/${currentId}/${section.slug}`}
                className="hover:opacity-80"
                style={
                  tournamentSection === section.slug
                    ? { color: "var(--accent)", fontWeight: 600 }
                    : undefined
                }
              >
                {section.label}
              </Link>
            ))}
      </nav>
    </div>
  );
}
