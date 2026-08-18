"use client";

import { useEffect, useState } from "react";
import localFont from "next/font/local";

import CountryBadge from "@/components/overlay/CountryBadge";
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
 * Police d'accroche du stream ("Hanson Bold", fichier fourni par le
 * prestataire dans app/fonts/HansonBold.ttf) — auto-hébergée et optimisée
 * par Next.js (next/font/local), donc affichée correctement quelle que soit
 * la machine qui charge la page, sans dépendre d'une police installée
 * localement comme le ferait une simple référence par nom.
 */
const hansonBold = localFont({
  src: "../../app/fonts/HansonBold.ttf",
  weight: "700",
  display: "swap",
});

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

  return (
    // Conteneur extérieur : occupe toute la Browser Source OBS, quelle que
    // soit sa taille/son ratio réel, et centre un cadre verrouillé en 16:9
    // à l'intérieur (letterboxing sur les côtés/haut-bas si la source n'est
    // pas exactement 16:9) — sans ce verrouillage, les positions et tailles
    // de texte (en % / cqw du cadre) dérivaient visiblement dès que la
    // Browser Source n'était pas configurée en 1920x1080 pile.
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div
        className={hansonBold.className}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16/9",
          maxHeight: "100%",
          overflow: "hidden",
          containerType: "inline-size",
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

        {match.competitorA?.countryCode && (
          <span style={positionStyle(layout.flagA)}>
            <CountryBadge countryCode={match.competitorA.countryCode} fontSize="1.1cqw" />
          </span>
        )}
        <Text layout={layout} elementKey="nameA" size="1.7cqw">
          {match.competitorA?.name ?? "?"}
        </Text>
        {match.competitorA?.tag && (
          <Text layout={layout} elementKey="tagA" size="1.1cqw" color="#d1d5db" weight={600}>
            {match.competitorA.tag}
          </Text>
        )}

        {match.competitorB?.countryCode && (
          <span style={positionStyle(layout.flagB)}>
            <CountryBadge countryCode={match.competitorB.countryCode} fontSize="1.1cqw" />
          </span>
        )}
        <Text layout={layout} elementKey="nameB" size="1.7cqw">
          {match.competitorB?.name ?? "?"}
        </Text>
        {match.competitorB?.tag && (
          <Text layout={layout} elementKey="tagB" size="1.1cqw" color="#d1d5db" weight={600}>
            {match.competitorB.tag}
          </Text>
        )}

        <Text layout={layout} elementKey="scoreA" size="2cqw" weight={900}>
          {match.competitorA?.score ?? 0}
        </Text>
        <Text layout={layout} elementKey="scoreB" size="2cqw" weight={900}>
          {match.competitorB?.score ?? 0}
        </Text>
      </div>
    </div>
  );
}
