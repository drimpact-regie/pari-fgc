"use client";

import { useEffect, useState } from "react";

import { countryCodeToFlagEmoji } from "@/lib/flags";
import {
  mergeOverlayLayout,
  OVERLAY_CANVAS_HEIGHT,
  OVERLAY_CANVAS_WIDTH,
  type OverlayElementKey,
  type OverlayLayout,
} from "@/lib/invitationalOverlayLayout";

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

interface OverlayMatchResponse {
  match: OverlayMatch | null;
  overlayBackgroundUrl: string | null;
  overlayLayout: unknown;
}

const POLL_INTERVAL_MS = 3000;

/**
 * Police d'accroche du stream ("Hanson Bold") — pas de fichier de police
 * fourni/embarqué ici : ce nom résout vers une police du même nom déjà
 * installée sur la machine qui affiche la page (celle qui fait tourner OBS,
 * comme n'importe quel navigateur système), sinon retombe sur sans-serif.
 * Voir la doc affichée dans l'admin/la page partenaire.
 */
const OVERLAY_FONT_FAMILY = '"Hanson Bold", sans-serif';

const TEXT_SHADOW = "0 2px 6px rgba(0,0,0,0.85)";

function positionStyle(pos: { x: number; y: number }): React.CSSProperties {
  return {
    position: "absolute",
    left: `${(pos.x / OVERLAY_CANVAS_WIDTH) * 100}%`,
    top: `${(pos.y / OVERLAY_CANVAS_HEIGHT) * 100}%`,
  };
}

function Text({
  layout,
  elementKey,
  children,
  size,
  color = "#fff",
  weight = 800,
}: {
  layout: OverlayLayout;
  elementKey: OverlayElementKey;
  children: React.ReactNode;
  size: string;
  color?: string;
  weight?: number;
}) {
  return (
    <span
      style={{
        ...positionStyle(layout[elementKey]),
        fontSize: size,
        fontWeight: weight,
        color,
        textShadow: TEXT_SHADOW,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export default function OverlayMatchView({ eventId }: { eventId: string }) {
  const [data, setData] = useState<OverlayMatchResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/invitational/overlay/${eventId}/match`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (!cancelled) {
          setData(json);
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

  const match = data?.match ?? null;

  if (!loaded || !match || (!match.competitorA && !match.competitorB)) {
    return null;
  }

  const layout = mergeOverlayLayout(data?.overlayLayout);
  const flagA = match.competitorA ? countryCodeToFlagEmoji(match.competitorA.countryCode) : null;
  const flagB = match.competitorB ? countryCodeToFlagEmoji(match.competitorB.countryCode) : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        containerType: "inline-size",
        fontFamily: OVERLAY_FONT_FAMILY,
      }}
    >
      {data?.overlayBackgroundUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- image en data: URL (base64), incompatible avec next/image (optimisation d'URL distante).
        <img
          src={data.overlayBackgroundUrl}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}

      {match.groupLabel && (
        <Text layout={layout} elementKey="stage" size="1.6cqw" color="#fbbf24" weight={700}>
          {match.groupLabel}
        </Text>
      )}
      {match.ftGames && (
        <Text layout={layout} elementKey="ft" size="1.3cqw" color="#9ca3af" weight={600}>
          FT{match.ftGames}
        </Text>
      )}

      {flagA && (
        <span style={{ ...positionStyle(layout.flagA), fontSize: "2.4cqw" }}>{flagA}</span>
      )}
      <Text layout={layout} elementKey="nameA" size="2.4cqw">
        {match.competitorA?.name ?? "?"}
      </Text>
      {match.competitorA?.tag && (
        <Text layout={layout} elementKey="tagA" size="1.4cqw" color="#d1d5db" weight={600}>
          {match.competitorA.tag}
        </Text>
      )}

      {flagB && (
        <span style={{ ...positionStyle(layout.flagB), fontSize: "2.4cqw" }}>{flagB}</span>
      )}
      <Text layout={layout} elementKey="nameB" size="2.4cqw">
        {match.competitorB?.name ?? "?"}
      </Text>
      {match.competitorB?.tag && (
        <Text layout={layout} elementKey="tagB" size="1.4cqw" color="#d1d5db" weight={600}>
          {match.competitorB.tag}
        </Text>
      )}

      <span
        style={{
          ...positionStyle(layout.score),
          fontSize: "3cqw",
          fontWeight: 900,
          color: "#fff",
          textShadow: TEXT_SHADOW,
          whiteSpace: "nowrap",
        }}
      >
        {match.competitorA?.score ?? 0} — {match.competitorB?.score ?? 0}
      </span>
    </div>
  );
}
