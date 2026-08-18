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

interface OverlayBracketData {
  event: { id: string; name: string; format: string };
  isBracketFormat: boolean;
  bracket: BracketColumn[] | null;
  standings: StandingsRow[] | null;
  matches: MatchListEntry[] | null;
  upcoming: UpcomingMatch[];
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

function UpcomingPanel({ upcoming }: { upcoming: UpcomingMatch[] }) {
  if (upcoming.length === 0) return null;
  return (
    <div
      className="flex flex-col gap-2 px-4 py-3 rounded-lg"
      style={{
        position: "absolute",
        left: "2%",
        bottom: "2%",
        background: "rgba(11,13,18,0.72)",
        backdropFilter: "blur(4px)",
        minWidth: "18rem",
      }}
    >
      <p style={{ fontSize: "0.75rem", fontWeight: 800, color: "#fbbf24", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Prochains matchs
      </p>
      {upcoming.map((m) => {
        const range = formatTimeRange(m.startMin, m.startMax);
        return (
          <div key={m.id} className="flex items-center justify-between gap-3" style={{ fontSize: "0.8rem", color: "#fff" }}>
            <span className="inline-flex items-center gap-1.5">
              {m.competitorA?.countryCode && <CountryBadge countryCode={m.competitorA.countryCode} fontSize="0.65rem" />}
              {competitorName(m.competitorA)} <span style={{ color: "#6b7280" }}>vs</span>{" "}
              {m.competitorB?.countryCode && <CountryBadge countryCode={m.competitorB.countryCode} fontSize="0.65rem" />}
              {competitorName(m.competitorB)}
            </span>
            {range && <span style={{ color: "#9ca3af", fontWeight: 600, whiteSpace: "nowrap" }}>{range}</span>}
          </div>
        );
      })}
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
          <div className="p-4">
            <InvitationalBracket columns={data.bracket} />
          </div>
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

        <UpcomingPanel upcoming={data.upcoming} />
      </div>
    </div>
  );
}
