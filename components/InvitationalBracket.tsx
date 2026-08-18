import { computeWinnersColumnYFractions, type BracketColumnSide } from "@/lib/invitationalBracketTemplate";

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
  /** "legacy" = pas de taille de bracket choisie pour l'event (voir InvitationalEvent.bracketSize) : rendu à espacement égal, sans lignes de connexion (comportement historique). */
  side: BracketColumnSide | "legacy";
  /** Un slot `null` = round pas encore atteint/importé (gabarit, voir lib/invitationalBracketTemplate.ts) — jamais le cas en "legacy". */
  matches: (BracketMatch | null)[];
}

const MATCH_CARD_HEIGHT = 64;
const MATCH_GAP = 12;
const CONNECTOR_WIDTH = 40;

function competitorLabel(c: BracketCompetitor | null): string {
  if (!c) return "?";
  return c.tag ? `${c.tag} | ${c.name}` : c.name;
}

function MatchCard({ match, height }: { match: BracketMatch | null; height?: number }) {
  if (!match) {
    return (
      <div
        className="rounded-lg px-3 py-2 flex flex-col gap-1 justify-center"
        style={{ height, border: "1px dashed rgba(255,255,255,0.15)", boxSizing: "border-box" }}
      >
        <span style={{ fontSize: "0.75rem", color: "#4b5563", textAlign: "center" }}>À déterminer</span>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg px-3 py-2 flex flex-col gap-1 justify-center"
      style={{ height, boxSizing: "border-box", background: "rgba(11,13,18,0.72)", backdropFilter: "blur(4px)" }}
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

function ColumnHeader({ label }: { label: string }) {
  return (
    <p
      className="text-center"
      style={{ fontSize: "0.75rem", fontWeight: 800, color: "#fbbf24", letterSpacing: "0.04em", textTransform: "uppercase" }}
    >
      {label}
    </p>
  );
}

/**
 * Lignes de connexion entre deux colonnes adjacentes du camp des vainqueurs
 * (voir computeWinnersColumnYFractions) — tracé en chevron classique d'un
 * bracket : segment horizontal depuis chaque match du round précédent,
 * segment vertical au milieu de l'écart, segment horizontal vers le match
 * du round suivant qui en découle (slot 2i et 2i+1 -> slot i).
 */
function WinnersConnector({ fromYs, toYs, height }: { fromYs: number[]; toYs: number[]; height: number }) {
  const mid = CONNECTOR_WIDTH / 2;
  return (
    <svg width={CONNECTOR_WIDTH} height={height} style={{ flexShrink: 0 }}>
      <g stroke="rgba(251,191,36,0.45)" strokeWidth={2} fill="none">
        {toYs.map((toY, i) => {
          const yTop = fromYs[2 * i] * height;
          const yBottom = fromYs[2 * i + 1] * height;
          const yTarget = toY * height;
          return (
            <g key={i}>
              <path d={`M0 ${yTop} H${mid}`} />
              <path d={`M0 ${yBottom} H${mid}`} />
              <path d={`M${mid} ${yTop} V${yBottom}`} />
              <path d={`M${mid} ${yTarget} H${CONNECTOR_WIDTH}`} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/**
 * Camp des vainqueurs (ou tout le bracket en simple élimination, un seul
 * camp) : géométrie exacte connue (chaque round est simplement la moitié
 * du précédent), donc positions verticales calculées et vraies lignes de
 * connexion — voir lib/invitationalBracketTemplate.ts pour l'algorithme.
 */
function WinnersTree({ columns }: { columns: BracketColumn[] }) {
  const yFractionsByColumn = computeWinnersColumnYFractions(columns.map((c) => c.matches.length));
  const leafCount = columns[0]?.matches.length ?? 1;
  const height = leafCount * MATCH_CARD_HEIGHT + (leafCount - 1) * MATCH_GAP;

  return (
    <>
      {columns.map((column, colIndex) => (
        <div key={column.key} className="flex items-stretch">
          <div className="flex flex-col gap-2" style={{ minWidth: "13rem" }}>
            <ColumnHeader label={column.label} />
            <div style={{ position: "relative", height }}>
              {column.matches.map((match, i) => (
                <div
                  key={match?.id ?? `${column.key}-${i}`}
                  style={{
                    position: "absolute",
                    top: yFractionsByColumn[colIndex][i] * height - MATCH_CARD_HEIGHT / 2,
                    left: 0,
                    right: 0,
                  }}
                >
                  <MatchCard match={match} height={MATCH_CARD_HEIGHT} />
                </div>
              ))}
            </div>
          </div>
          {colIndex < columns.length - 1 && (
            <div className="flex items-end pb-0" style={{ marginTop: "1.5rem" }}>
              <WinnersConnector fromYs={yFractionsByColumn[colIndex]} toYs={yFractionsByColumn[colIndex + 1]} height={height} />
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/**
 * Camp des perdants, colonnes "final" (Grand Final/Reset), et rendu
 * "legacy" (event sans taille de bracket choisie) : approximation à
 * espacement égal, sans lignes de connexion précises — la géométrie de ce
 * camp ne se déduit pas simplement d'un round à l'autre (deux rounds
 * consécutifs peuvent avoir le même nombre de matchs, voir
 * lib/invitationalBracketTemplate.ts), donc pas de tracé fiable sans
 * connaître les vraies relations de qualification (hors périmètre, voir le
 * prompt d'origine).
 */
function FlatColumn({ column }: { column: BracketColumn }) {
  return (
    <div className="flex flex-col gap-2" style={{ minWidth: "13rem" }}>
      <ColumnHeader label={column.label} />
      <div className="flex-1 flex flex-col justify-around gap-3">
        {column.matches.map((match, i) => (
          <MatchCard key={match?.id ?? `${column.key}-${i}`} match={match} />
        ))}
      </div>
    </div>
  );
}

export default function InvitationalBracket({ columns }: { columns: BracketColumn[] }) {
  if (columns.length === 0) return null;

  // Le camp des vainqueurs (ou tout le bracket en simple élimination) est
  // toujours un préfixe contigu des colonnes (voir getBracketTemplate) : on
  // le rend en arbre géométrique, le reste (camp des perdants, Grand
  // Final/Reset, ou tout en "legacy") à espacement égal.
  const firstNonWinnersIndex = columns.findIndex((c) => c.side !== "winners");
  const winnersColumns = firstNonWinnersIndex === -1 ? columns : columns.slice(0, firstNonWinnersIndex);
  const restColumns = firstNonWinnersIndex === -1 ? [] : columns.slice(firstNonWinnersIndex);

  return (
    <div className="flex items-start gap-6 overflow-x-auto">
      {winnersColumns.length > 0 && <WinnersTree columns={winnersColumns} />}
      {restColumns.map((column) => (
        <FlatColumn key={column.key} column={column} />
      ))}
    </div>
  );
}
