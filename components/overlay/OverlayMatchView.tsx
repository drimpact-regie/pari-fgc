"use client";

import { useEffect, useState } from "react";

import { countryCodeToFlagEmoji } from "@/lib/flags";

interface OverlayCompetitor {
  name: string;
  tag: string | null;
  countryCode: string | null;
  score: number | null;
  placeholder?: boolean;
}

interface OverlayMatch {
  id: string;
  groupLabel: string | null;
  status: "NOT_OPEN" | "OPEN" | "CLOSED" | "COMPLETED";
  ftGames: number | null;
  competitorA: OverlayCompetitor | null;
  competitorB: OverlayCompetitor | null;
}

const POLL_INTERVAL_MS = 3000;

function CompetitorBlock({ competitor, align }: { competitor: OverlayCompetitor | null; align: "left" | "right" }) {
  const flag = competitor ? countryCodeToFlagEmoji(competitor.countryCode) : null;
  return (
    <div
      className="flex flex-col gap-1"
      style={{ alignItems: align === "left" ? "flex-start" : "flex-end", flex: 1, minWidth: 0 }}
    >
      <div className="flex items-center gap-2" style={{ flexDirection: align === "left" ? "row" : "row-reverse" }}>
        {flag && <span style={{ fontSize: "1.5rem" }}>{flag}</span>}
        <span
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            color: "#fff",
            textShadow: "0 2px 6px rgba(0,0,0,0.85)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {competitor?.tag ? `${competitor.tag} | ${competitor.name}` : (competitor?.name ?? "?")}
        </span>
      </div>
    </div>
  );
}

export default function OverlayMatchView({ eventId }: { eventId: string }) {
  const [match, setMatch] = useState<OverlayMatch | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/invitational/overlay/${eventId}/match`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setMatch(data.match ?? null);
          setLoaded(true);
        }
      } catch {
        // best-effort — l'overlay retentera au prochain intervalle, pas de message d'erreur visible en stream.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [eventId]);

  if (!loaded || !match || (!match.competitorA && !match.competitorB)) {
    return null;
  }

  return (
    <div
      className="inline-flex flex-col gap-2 px-8 py-4 rounded-xl"
      style={{ background: "rgba(11,13,18,0.72)", backdropFilter: "blur(4px)" }}
    >
      {match.groupLabel && (
        <div className="flex items-center justify-center gap-3 text-center">
          <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fbbf24", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {match.groupLabel}
          </span>
          {match.ftGames && (
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#9ca3af" }}>FT{match.ftGames}</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-6">
        <CompetitorBlock competitor={match.competitorA} align="left" />
        <div className="flex items-center gap-3 shrink-0" style={{ fontSize: "2.25rem", fontWeight: 900, color: "#fff", textShadow: "0 2px 6px rgba(0,0,0,0.85)" }}>
          <span>{match.competitorA?.score ?? 0}</span>
          <span style={{ color: "#6b7280", fontSize: "1.25rem" }}>—</span>
          <span>{match.competitorB?.score ?? 0}</span>
        </div>
        <CompetitorBlock competitor={match.competitorB} align="right" />
      </div>
    </div>
  );
}
