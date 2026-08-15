"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface TournamentSummary {
  id: string;
  name: string;
}

const SECTIONS = [
  { slug: "matches", label: "Matchs" },
  { slug: "players", label: "Joueurs" },
  { slug: "leaderboard", label: "Classement" },
] as const;

export default function TournamentNav({
  tournaments,
  currentId,
}: {
  tournaments: TournamentSummary[];
  currentId: string;
}) {
  const pathname = usePathname();
  const currentSection =
    SECTIONS.find((s) => pathname.endsWith(`/${s.slug}`))?.slug ?? "matches";

  return (
    <div className="flex flex-col gap-3">
      {tournaments.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/t/${t.id}/${currentSection}`}
              className="px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors"
              style={
                t.id === currentId
                  ? { background: "var(--accent)", color: "#0b0d12", fontWeight: 600 }
                  : { background: "var(--surface-alt)", color: "var(--foreground)" }
              }
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      <nav className="flex gap-4 text-sm border-b pb-2" style={{ borderColor: "var(--border)" }}>
        {SECTIONS.map((section) => (
          <Link
            key={section.slug}
            href={`/t/${currentId}/${section.slug}`}
            className="hover:opacity-80"
            style={
              currentSection === section.slug
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
