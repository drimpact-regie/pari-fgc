"use client";

import { useLayoutEffect, useRef, useState } from "react";

import type { BracketColumn } from "@/lib/bracket";
import { SET_STATE, type StartggSet } from "@/lib/startgg";

interface Props {
  winners: BracketColumn[];
  grandFinal: BracketColumn[];
  losers: BracketColumn[];
}

interface ConnectorPath {
  d: string;
}

/**
 * Calcule, pour une transition entre deux colonnes, quel match de la
 * colonne suivante chaque match de la colonne courante alimente. Sans les
 * relations prereqType/prereqId de start.gg (non récupérées côté API pour
 * l'instant), on part de l'hypothèse standard : les colonnes qui réduisent
 * de moitié fusionnent des paires adjacentes (bracket winners, et les
 * rounds losers qui absorbent les perdants du winners) ; les colonnes de
 * même taille sont un passage direct 1 pour 1 (rounds losers qui ne font
 * qu'avancer les gagnants du round losers précédent). Approximation
 * raisonnable pour l'immense majorité des brackets standards, pas garantie
 * exacte dans les cas atypiques.
 */
function targetIndex(sourceIndex: number, sourceCount: number, targetCount: number): number {
  if (targetCount === 0) return 0;
  if (sourceCount === targetCount * 2) return Math.floor(sourceIndex / 2);
  if (sourceCount === targetCount) return sourceIndex;
  return Math.min(targetCount - 1, Math.floor((sourceIndex * targetCount) / sourceCount));
}

function MatchCard({
  set,
  cardRef,
}: {
  set: StartggSet;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const isLive = set.state === SET_STATE.STARTED;
  const winnerId = set.winnerId != null ? String(set.winnerId) : null;

  return (
    <div
      ref={cardRef}
      className="rounded-md border text-xs w-44 shrink-0 overflow-hidden"
      style={{ borderColor: isLive ? "var(--win)" : "var(--border)", background: "var(--surface-alt)" }}
    >
      {set.slots.map((slot, i) => {
        const isLoser = winnerId != null && slot.entrant != null && slot.entrant.id !== winnerId;
        return (
          <div
            key={i}
            className="flex items-center justify-between gap-2 px-2 py-1"
            style={{
              borderTop: i > 0 ? "1px solid var(--border)" : undefined,
              opacity: isLoser ? 0.55 : 1,
            }}
          >
            <span className="truncate">{slot.entrant?.name ?? "À déterminer"}</span>
            {slot.score != null && <span className="font-semibold shrink-0">{slot.score}</span>}
          </div>
        );
      })}
    </div>
  );
}

function BracketRow({
  columns,
  title,
}: {
  columns: BracketColumn[];
  title: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[][]>([]);
  const [paths, setPaths] = useState<ConnectorPath[]>([]);
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function recompute() {
      if (!container) return;
      const containerBox = container.getBoundingClientRect();
      const centers: { x: number; y: number }[][] = cardRefs.current.map((col) =>
        col.map((el) => {
          if (!el) return { x: 0, y: 0 };
          const box = el.getBoundingClientRect();
          return {
            x: box.left - containerBox.left,
            y: box.top - containerBox.top + box.height / 2,
            right: box.right - containerBox.left,
          } as { x: number; y: number; right: number };
        }),
      );

      const newPaths: ConnectorPath[] = [];
      for (let c = 0; c < columns.length - 1; c++) {
        const sourceCenters = centers[c] as { x: number; y: number; right: number }[];
        const targetCenters = centers[c + 1] as { x: number; y: number; right: number }[];
        sourceCenters.forEach((source, i) => {
          const t = targetIndex(i, sourceCenters.length, targetCenters.length);
          const target = targetCenters[t];
          if (!source || !target) return;
          const midX = (source.right + target.x) / 2;
          newPaths.push({
            d: `M ${source.right} ${source.y} H ${midX} V ${target.y} H ${target.x}`,
          });
        });
      }
      setPaths(newPaths);
      setSvgSize({ width: containerBox.width, height: containerBox.height });
    }

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    return () => observer.disconnect();
  }, [columns]);

  if (columns.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        {title}
      </p>
      <div className="overflow-x-auto">
        <div ref={containerRef} className="relative flex items-stretch gap-10 p-2 min-w-max">
          <svg
            className="absolute inset-0 pointer-events-none"
            width={svgSize.width}
            height={svgSize.height}
          >
            {paths.map((p, i) => (
              <path key={i} d={p.d} fill="none" stroke="var(--border)" strokeWidth={2} />
            ))}
          </svg>
          {columns.map((column, colIndex) => (
            <div key={colIndex} className="flex flex-col justify-around gap-4">
              <p className="text-[11px] font-medium text-center" style={{ color: "var(--muted)" }}>
                {column.label}
              </p>
              <div className="flex flex-col justify-around gap-6 flex-1">
                {column.sets.map((set, setIndex) => (
                  <MatchCard
                    key={set.id}
                    set={set}
                    cardRef={(el) => {
                      if (!cardRefs.current[colIndex]) cardRefs.current[colIndex] = [];
                      cardRefs.current[colIndex][setIndex] = el;
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Vue en arbre (façon bracket start.gg) pour une phase à élimination
 * directe déjà connue (typiquement le Top 8) — winners bracket + grande
 * finale d'un côté, losers bracket de l'autre, avec des lignes de connexion
 * calculées après montage (voir BracketRow) plutôt qu'approximées en CSS
 * pur, pour rester correct quel que soit le nombre de matchs par round.
 */
export default function Top8Bracket({ winners, grandFinal, losers }: Props) {
  const winnersAndFinal = [...winners, ...grandFinal];
  if (winnersAndFinal.length === 0 && losers.length === 0) return null;

  return (
    <div className="card p-4 flex flex-col gap-6">
      <BracketRow columns={winnersAndFinal} title="Winners bracket" />
      <BracketRow columns={losers} title="Losers bracket" />
    </div>
  );
}
