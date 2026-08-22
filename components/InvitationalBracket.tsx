import type { BracketColumnSide } from "@/lib/invitationalBracketTemplate";
import BracketTree, { type BracketTreeColumn } from "@/components/BracketTree";

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
  key: string;
  label: string;
  /** "legacy" = pas de taille de bracket choisie pour l'event (voir InvitationalEvent.bracketSize) — le camp (winners/losers) est alors déduit du libellé du round plutôt que connu à l'avance, voir classifyLegacyColumnSide. */
  side: BracketColumnSide | "legacy";
  /** Un slot `null` = round pas encore atteint/importé (gabarit, voir lib/invitationalBracketTemplate.ts) — jamais le cas en "legacy". */
  matches: (BracketMatch | null)[];
}

function competitorLabel(c: BracketCompetitor | null): string {
  if (!c) return "?";
  return c.tag ? `${c.tag} | ${c.name}` : c.name;
}

function MatchCard({ match }: { match: BracketMatch | null }) {
  if (!match) {
    return (
      <div
        className="rounded-lg px-3 py-2 flex flex-col gap-1 justify-center w-44"
        style={{ height: 64, border: "1px dashed rgba(255,255,255,0.15)", boxSizing: "border-box" }}
      >
        <span style={{ fontSize: "0.75rem", color: "#4b5563", textAlign: "center" }}>À déterminer</span>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg px-3 py-2 flex flex-col gap-1 justify-center w-44"
      style={{ height: 64, boxSizing: "border-box", background: "rgba(11,13,18,0.72)", backdropFilter: "blur(4px)" }}
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
            <span style={{ fontSize: "0.8rem", fontWeight: 800, color: isWinner ? "#fbbf24" : "#6b7280" }}>{slot.score ?? "-"}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Un event "legacy" (pas de taille de bracket choisie) n'a pas de `side`
 * connu à l'avance — mais pour le mode régie (voir lib/tournamentRegie.ts),
 * le libellé de chaque colonne EST le vrai nom de round start.gg
 * ("Winners Round 1", "Losers Round 2", "Grand Final"...), qui suffit à
 * déduire le camp de façon fiable sans configuration supplémentaire.
 */
function classifyLegacyColumnSide(label: string): "losers" | "winners" {
  return /^losers?\b/i.test(label.trim()) ? "losers" : "winners";
}

function columnSide(column: BracketColumn): "losers" | "winners" {
  if (column.side === "losers") return "losers";
  if (column.side === "winners" || column.side === "final") return "winners";
  return classifyLegacyColumnSide(column.label);
}

function toTreeColumns(columns: BracketColumn[]): BracketTreeColumn<BracketMatch>[] {
  return columns.map((c) => ({ key: c.key, label: c.label, matches: c.matches }));
}

/**
 * Bracket Invitational/Prestataire (et mode régie, voir
 * lib/tournamentRegie.ts) : même moteur de rendu que Top8Bracket (arbre à
 * vraies lignes de connexion mesurées en DOM, voir components/BracketTree.tsx)
 * plutôt que l'ancien calcul géométrique approximatif — celui-ci ne gérait
 * correctement que le camp des vainqueurs et retombait sur un espacement
 * égal sans ligne pour tout le reste (camp des perdants, et systématiquement
 * tous les rounds en mode "legacy", cas du mode régie qui ne choisit jamais
 * de taille de bracket).
 */
export default function InvitationalBracket({ columns }: { columns: BracketColumn[] }) {
  if (columns.length === 0) return null;

  const winnersColumns = columns.filter((c) => columnSide(c) === "winners");
  const losersColumns = columns.filter((c) => columnSide(c) === "losers");

  return (
    <div className="flex flex-col gap-6">
      <BracketTree
        columns={toTreeColumns(winnersColumns)}
        title={losersColumns.length > 0 ? "Winners bracket" : undefined}
        renderMatch={(match) => <MatchCard match={match} />}
      />
      <BracketTree
        columns={toTreeColumns(losersColumns)}
        title="Losers bracket"
        renderMatch={(match) => <MatchCard match={match} />}
      />
    </div>
  );
}
