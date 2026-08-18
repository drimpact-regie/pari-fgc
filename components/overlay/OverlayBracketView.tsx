"use client";

import { useEffect, useState } from "react";

import InvitationalBracket, { type BracketColumn } from "@/components/InvitationalBracket";
import CountryBadge from "@/components/overlay/CountryBadge";

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
      style={{ background: "rgba(11,13,18,0.72)", backdropFilter: "blur(4px)", minWidth: "18rem" }}
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

  return (
    <div className="flex flex-col gap-4 p-4">
      {data.isBracketFormat && data.bracket ? (
        <InvitationalBracket columns={data.bracket} />
      ) : (
        <div className="flex items-start gap-6">
          {data.standings && data.standings.length > 0 && (
            <div className="rounded-lg px-2 py-2" style={{ background: "rgba(11,13,18,0.72)", backdropFilter: "blur(4px)" }}>
              <StandingsTable standings={data.standings} />
            </div>
          )}
          {data.matches && data.matches.length > 0 && (
            <div className="rounded-lg px-4 py-3" style={{ background: "rgba(11,13,18,0.72)", backdropFilter: "blur(4px)" }}>
              <MatchListTable matches={data.matches} />
            </div>
          )}
        </div>
      )}

      <UpcomingPanel upcoming={data.upcoming} />
    </div>
  );
}
