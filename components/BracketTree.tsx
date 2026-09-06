"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Moteur de rendu d'arbre de bracket partagé (extrait de l'ancien
 * Top8Bracket, seul endroit qui calculait déjà de vraies lignes de
 * connexion) — les positions des cases sont mesurées après montage (DOM),
 * pas approximées par une formule géométrique : fonctionne donc à
 * l'identique quel que soit le nombre de matchs par round, y compris pour
 * le camp des perdants où deux rounds consécutifs peuvent avoir le même
 * nombre de matchs (aucune formule simple round→round n'est fiable dans ce
 * cas, contrairement au camp des vainqueurs).
 */

export interface BracketTreeColumn<T> {
  key: string;
  label: string;
  matches: (T | null)[];
}

interface ConnectorPath {
  d: string;
}

/**
 * Détermine, pour une transition entre deux colonnes, quel match de la
 * colonne suivante chaque match de la colonne courante alimente — voir la
 * doc d'origine dans Top8Bracket : hypothèse standard (paires adjacentes
 * fusionnent, tailles égales passent 1 pour 1), pas garantie exacte dans
 * les cas atypiques.
 */
function targetIndex(sourceIndex: number, sourceCount: number, targetCount: number): number {
  if (targetCount === 0) return 0;
  if (sourceCount === targetCount * 2) return Math.floor(sourceIndex / 2);
  if (sourceCount === targetCount) return sourceIndex;
  return Math.min(targetCount - 1, Math.floor((sourceIndex * targetCount) / sourceCount));
}

export default function BracketTree<T>({
  columns,
  renderMatch,
  title,
}: {
  columns: BracketTreeColumn<T>[];
  renderMatch: (match: T | null) => React.ReactNode;
  title?: string;
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
      const centers = cardRefs.current.map((col) =>
        col.map((el) => {
          if (!el) return { x: 0, y: 0, right: 0 };
          const box = el.getBoundingClientRect();
          return {
            x: box.left - containerBox.left,
            y: box.top - containerBox.top + box.height / 2,
            right: box.right - containerBox.left,
          };
        }),
      );

      const newPaths: ConnectorPath[] = [];
      for (let c = 0; c < columns.length - 1; c++) {
        const sourceCenters = centers[c] ?? [];
        const targetCenters = centers[c + 1] ?? [];
        sourceCenters.forEach((source, i) => {
          const t = targetIndex(i, sourceCenters.length, targetCenters.length);
          const target = targetCenters[t];
          if (!source || !target) return;
          const midX = (source.right + target.x) / 2;
          newPaths.push({ d: `M ${source.right} ${source.y} H ${midX} V ${target.y} H ${target.x}` });
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
      {title && (
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9ca3af" }}>
          {title}
        </p>
      )}
      <div className="overflow-x-auto">
        <div ref={containerRef} className="relative flex items-stretch gap-10 p-2 min-w-max">
          <svg className="absolute inset-0 pointer-events-none" width={svgSize.width} height={svgSize.height}>
            {paths.map((p, i) => (
              <path key={i} d={p.d} fill="none" stroke="rgba(251,191,36,0.45)" strokeWidth={2} />
            ))}
          </svg>
          {columns.map((column, colIndex) => (
            <div key={column.key} className="flex flex-col justify-around gap-4">
              <p
                className="text-center"
                style={{ fontSize: "0.75rem", fontWeight: 800, color: "#fbbf24", letterSpacing: "0.04em", textTransform: "uppercase" }}
              >
                {column.label}
              </p>
              <div className="flex flex-col justify-around gap-6 flex-1">
                {column.matches.map((match, matchIndex) => (
                  <div
                    key={matchIndex}
                    // self-start : sans ça, ce wrapper (sans largeur propre)
                    // s'étire par défaut (align-items: stretch) à la largeur
                    // de la colonne plutôt que de se limiter à la carte
                    // qu'il contient — ce qui décalerait la mesure DOM des
                    // lignes de connexion (position.right ne tomberait plus
                    // sur le bord réel de la carte).
                    className="self-start"
                    ref={(el) => {
                      if (!cardRefs.current[colIndex]) cardRefs.current[colIndex] = [];
                      cardRefs.current[colIndex][matchIndex] = el;
                    }}
                  >
                    {renderMatch(match)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
