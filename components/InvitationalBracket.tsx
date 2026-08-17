export interface BracketCompetitor {
  name: string;
  tag: string | null;
  countryCode: string | null;
}

export interface BracketMatch {
  id: string;
  competitorA: BracketCompetitor | null;
  competitorB: BracketCompetitor | null;
  scoreA: number | null;
  scoreB: number | null;
  status: "NOT_OPEN" | "OPEN" | "CLOSED" | "COMPLETED";
  winnerId: string | null;
  competitorAId: string | null;
  competitorBId: string | null;
}

export interface BracketColumn {
  label: string;
  matches: BracketMatch[];
}

function competitorLabel(c: BracketCompetitor | null): string {
  if (!c) return "?";
  return c.tag ? `${c.tag} | ${c.name}` : c.name;
}

/**
 * Arbre visuel de bracket pour l'overlay OBS — construit à partir des
 * colonnes déjà groupées côté serveur (voir lib/invitationalBracket.ts).
 * Approximation volontairement simple (pas de lignes de connexion précises,
 * faute de savoir quel match alimente réellement quel autre pour un event
 * invitational — voir la note dans lib/invitationalBracket.ts) : chaque
 * colonne espace ses matchs verticalement de façon égale, ce qui suffit à
 * lire un bracket standard en un coup d'œil sur un stream.
 */
export default function InvitationalBracket({ columns }: { columns: BracketColumn[] }) {
  if (columns.length === 0) return null;

  return (
    <div className="flex items-stretch gap-6 overflow-x-auto">
      {columns.map((column) => (
        <div key={column.label} className="flex flex-col gap-2" style={{ minWidth: "13rem" }}>
          <p
            className="text-center"
            style={{ fontSize: "0.75rem", fontWeight: 800, color: "#fbbf24", letterSpacing: "0.04em", textTransform: "uppercase" }}
          >
            {column.label}
          </p>
          <div className="flex-1 flex flex-col justify-around gap-3">
            {column.matches.map((match) => (
              <div
                key={match.id}
                className="rounded-lg px-3 py-2 flex flex-col gap-1"
                style={{ background: "rgba(11,13,18,0.72)", backdropFilter: "blur(4px)" }}
              >
                {[
                  { competitor: match.competitorA, id: match.competitorAId, score: match.scoreA },
                  { competitor: match.competitorB, id: match.competitorBId, score: match.scoreB },
                ].map((slot, i) => {
                  const isWinner = match.status === "COMPLETED" && match.winnerId === slot.id;
                  return (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: isWinner ? 800 : 500,
                          color: isWinner ? "#fff" : "#d1d5db",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {competitorLabel(slot.competitor)}
                      </span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 800, color: isWinner ? "#fbbf24" : "#6b7280" }}>
                        {slot.score ?? "-"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
