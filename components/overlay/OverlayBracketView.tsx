"use client";

import { useEffect, useState } from "react";

import InvitationalBracket, { type BracketColumn } from "@/components/InvitationalBracket";
import CountryBadge from "@/components/overlay/CountryBadge";
import {
  DEFAULT_BRACKET_OVERLAY_LAYOUT,
  OVERLAY_CANVAS_HEIGHT,
  OVERLAY_CANVAS_WIDTH,
  type BracketOverlayLayout,
} from "@/lib/invitationalBracketOverlayLayout";

interface OverlayCompetitor {
  name: string;
  tag: string | null;
  countryCode: string | null;
}

interface UpcomingMatch {
  id: string;
  groupLabel: string | null;
  competitorA: OverlayCompetitor | null;
  competitorB: OverlayCompetitor | null;
  startMin: string | null;
  startMax: string | null;
}

interface StandingsRow {
  competitorId: string;
  name: string;
  tag: string | null;
  wins: number;
  losses: number;
  played: number;
}

interface MatchListEntry {
  id: string;
  groupLabel: string | null;
  competitorA: OverlayCompetitor | null;
  competitorB: OverlayCompetitor | null;
  scoreA: number | null;
  scoreB: number | null;
  status: "NOT_OPEN" | "OPEN" | "CLOSED" | "COMPLETED";
}

interface RecentWinner {
  id: string;
  username: string;
  predictedCompetitorName: string;
  pointsAwarded: number;
  matchGroupLabel: string | null;
  competitorA: OverlayCompetitor | null;
  competitorB: OverlayCompetitor | null;
}

interface OverlayBracketData {
  event: { id: string; name: string; format: string };
  isBracketFormat: boolean;
  bracket: BracketColumn[] | null;
  standings: StandingsRow[] | null;
  matches: MatchListEntry[] | null;
  upcoming: UpcomingMatch[];
  recentWinners: RecentWinner[];
  bracketOverlayLayout: BracketOverlayLayout;
}

const POLL_INTERVAL_MS = 5000;

const STATUS_LABELS: Record<MatchListEntry["status"], string> = {
  NOT_OPEN: "À venir",
  OPEN: "Ouvert",
  CLOSED: "Fermé",
  COMPLETED: "Terminé",
};

function competitorName(c: OverlayCompetitor | null): string {
  if (!c) return "?";
  return c.tag ? `${c.tag} | ${c.name}` : c.name;
}

function formatTimeRange(startMin: string | null, startMax: string | null): string | null {
  if (!startMin || !startMax) return null;
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const min = fmt(startMin);
  const max = fmt(startMax);
  return min === max ? min : `${min} - ${max}`;
}

/**
 * Position + échelle d'un encadré du bracket overlay (voir
 * lib/invitationalBracketOverlayLayout.ts) — une échelle CSS uniforme
 * (transform: scale) plutôt qu'une police en cqw comme sur l'overlay "match
 * en cours" : ces encadrés sont des tableaux à plusieurs lignes, une
 * échelle globale suffit à les agrandir/réduire sans avoir à re-décliner
 * chaque taille de police interne en unité relative.
 */
function PositionedPanel({
  layout,
  elementKey,
  children,
}: {
  layout: BracketOverlayLayout;
  elementKey: keyof BracketOverlayLayout;
  children: React.ReactNode;
}) {
  const pos = layout[elementKey];
  return (
    <div
      style={{
        position: "absolute",
        left: `${(pos.x / OVERLAY_CANVAS_WIDTH) * 100}%`,
        top: `${(pos.y / OVERLAY_CANVAS_HEIGHT) * 100}%`,
        transform: `scale(${pos.size})`,
        transformOrigin: "top left",
      }}
    >
      {children}
    </div>
  );
}

function StandingsTable({ standings }: { standings: StandingsRow[] }) {
  return (
    <table style={{ borderCollapse: "collapse", fontSize: "0.85rem" }}>
      <thead>
        <tr style={{ color: "#9ca3af" }}>
          <th style={{ textAlign: "left", padding: "0.25rem 0.75rem" }}>Joueur</th>
          <th style={{ textAlign: "center", padding: "0.25rem 0.75rem" }}>V</th>
          <th style={{ textAlign: "center", padding: "0.25rem 0.75rem" }}>D</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((row) => (
          <tr key={row.competitorId} style={{ color: "#fff" }}>
            <td style={{ padding: "0.25rem 0.75rem", fontWeight: 600 }}>
              {row.tag ? `${row.tag} | ${row.name}` : row.name}
            </td>
            <td style={{ textAlign: "center", padding: "0.25rem 0.75rem", color: "#22c55e", fontWeight: 700 }}>{row.wins}</td>
            <td style={{ textAlign: "center", padding: "0.25rem 0.75rem", color: "#ef4444", fontWeight: 700 }}>{row.losses}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MatchListTable({ matches }: { matches: MatchListEntry[] }) {
  return (
    <div className="flex flex-col gap-1" style={{ fontSize: "0.8rem" }}>
      {matches.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-3" style={{ color: "#fff" }}>
          <span>
            {competitorName(m.competitorA)} <span style={{ color: "#6b7280" }}>vs</span> {competitorName(m.competitorB)}
          </span>
          <span style={{ color: m.status === "COMPLETED" ? "#22c55e" : "#9ca3af", fontWeight: 600 }}>
            {m.status === "COMPLETED" ? `${m.scoreA ?? 0}-${m.scoreB ?? 0}` : STATUS_LABELS[m.status]}
          </span>
        </div>
      ))}
    </div>
  );
}

type TickerItem =
  | { kind: "upcoming"; key: string; match: UpcomingMatch }
  | { kind: "winner"; key: string; winner: RecentWinner };

/**
 * Bandeau du bas de l'overlay bracket, entre matchs à venir et gagnants de
 * paris récents — voir Partie 1 du prompt overlay bracket. Les deux listes
 * sont entrelacées (un match, un gagnant, un match...) plutôt que montrées
 * en deux blocs séparés : ça mélange naturellement les deux contenus au fil
 * du défilement sans minuterie JS pour "alterner", une simple animation CSS
 * en boucle suffit.
 */
function buildTickerItems(upcoming: UpcomingMatch[], recentWinners: RecentWinner[]): TickerItem[] {
  const items: TickerItem[] = [];
  const max = Math.max(upcoming.length, recentWinners.length);
  for (let i = 0; i < max; i++) {
    if (upcoming[i]) items.push({ kind: "upcoming", key: `u-${upcoming[i].id}`, match: upcoming[i] });
    if (recentWinners[i]) items.push({ kind: "winner", key: `w-${recentWinners[i].id}`, winner: recentWinners[i] });
  }
  return items;
}

function TickerCard({ item }: { item: TickerItem }) {
  if (item.kind === "upcoming") {
    const range = formatTimeRange(item.match.startMin, item.match.startMax);
    return (
      <div className="inline-flex items-center gap-3 px-5" style={{ color: "#fff", whiteSpace: "nowrap" }}>
        <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#fbbf24", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Prochain
        </span>
        <span className="inline-flex items-center gap-1.5" style={{ fontSize: "0.85rem" }}>
          {item.match.competitorA?.countryCode && <CountryBadge countryCode={item.match.competitorA.countryCode} fontSize="0.65rem" />}
          {competitorName(item.match.competitorA)} <span style={{ color: "#6b7280" }}>vs</span>{" "}
          {item.match.competitorB?.countryCode && <CountryBadge countryCode={item.match.competitorB.countryCode} fontSize="0.65rem" />}
          {competitorName(item.match.competitorB)}
        </span>
        {range && <span style={{ fontSize: "0.8rem", color: "#9ca3af", fontWeight: 600 }}>{range}</span>}
      </div>
    );
  }

  const { winner } = item;
  return (
    <div className="inline-flex items-center gap-2 px-5" style={{ color: "#fff", whiteSpace: "nowrap" }}>
      <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#22c55e", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Pari gagné
      </span>
      <span style={{ fontSize: "0.85rem" }}>
        <strong>{winner.username}</strong> a gagné <strong style={{ color: "#22c55e" }}>{winner.pointsAwarded} Ex</strong> sur{" "}
        {winner.predictedCompetitorName}
        {winner.competitorA && winner.competitorB && (
          <span style={{ color: "#9ca3af" }}>
            {" "}
            ({competitorName(winner.competitorA)} vs {competitorName(winner.competitorB)})
          </span>
        )}
      </span>
    </div>
  );
}

function Ticker({ upcoming, recentWinners }: { upcoming: UpcomingMatch[]; recentWinners: RecentWinner[] }) {
  const items = buildTickerItems(upcoming, recentWinners);
  if (items.length === 0) return null;

  // Vitesse proportionnelle au nombre d'items (secondes fixes par item) —
  // sinon un event avec beaucoup de contenu défilerait aussi vite qu'un
  // event avec peu de contenu, illisible dans le premier cas.
  const durationSeconds = items.length * 4;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
        background: "rgba(11,13,18,0.72)",
        backdropFilter: "blur(4px)",
        padding: "0.6rem 0",
      }}
    >
      <div
        className="flex items-center"
        style={{ width: "max-content", animation: `invitational-ticker-scroll ${durationSeconds}s linear infinite` }}
      >
        {[...items, ...items].map((item, i) => (
          <TickerCard key={`${item.key}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function OverlayBracketView({ eventId }: { eventId: string }) {
  const [data, setData] = useState<OverlayBracketData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/invitational/overlay/${eventId}/bracket`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // best-effort — retentera au prochain intervalle.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [eventId]);

  if (!data) return null;

  const layout = data.bracketOverlayLayout ?? DEFAULT_BRACKET_OVERLAY_LAYOUT;

  return (
    // Même verrouillage 16:9 que l'overlay "match en cours" (voir
    // components/overlay/OverlayMatchView.tsx) : indispensable pour que les
    // positions en % ci-dessous tombent au même endroit quelle que soit la
    // taille réelle de la Browser Source OBS.
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16/9",
          maxHeight: "100%",
          overflow: "hidden",
          containerType: "inline-size",
        }}
      >
        {data.isBracketFormat && data.bracket ? (
          <PositionedPanel layout={layout} elementKey="bracket">
            <InvitationalBracket columns={data.bracket} />
          </PositionedPanel>
        ) : (
          <>
            {data.standings && data.standings.length > 0 && (
              <PositionedPanel layout={layout} elementKey="standings">
                <div className="rounded-lg px-2 py-2" style={{ background: "rgba(11,13,18,0.72)", backdropFilter: "blur(4px)" }}>
                  <StandingsTable standings={data.standings} />
                </div>
              </PositionedPanel>
            )}
            {data.matches && data.matches.length > 0 && (
              <PositionedPanel layout={layout} elementKey="matchList">
                <div className="rounded-lg px-4 py-3" style={{ background: "rgba(11,13,18,0.72)", backdropFilter: "blur(4px)" }}>
                  <MatchListTable matches={data.matches} />
                </div>
              </PositionedPanel>
            )}
          </>
        )}

        <Ticker upcoming={data.upcoming} recentWinners={data.recentWinners} />
      </div>
    </div>
  );
}
