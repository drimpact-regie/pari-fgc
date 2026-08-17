/**
 * Classement victoires/défaites pour les formats sans structure de bracket
 * (ROUND_ROBIN, SWISS, POOLS, LIST) — affiché sur
 * /overlay/invitational/[eventId]/bracket à la place de l'arbre visuel, qui
 * n'a pas de sens pour ces formats.
 */

export interface StandingsMatchInput {
  competitorAId: string | null;
  competitorBId: string | null;
  winnerId: string | null;
  status: "NOT_OPEN" | "OPEN" | "CLOSED" | "COMPLETED";
}

export interface StandingsCompetitorInput {
  id: string;
  name: string;
  tag: string | null;
}

export interface StandingsRow {
  competitorId: string;
  name: string;
  tag: string | null;
  wins: number;
  losses: number;
  played: number;
}

export function computeStandings(
  matches: StandingsMatchInput[],
  competitors: StandingsCompetitorInput[],
): StandingsRow[] {
  const wins = new Map<string, number>();
  const losses = new Map<string, number>();

  for (const match of matches) {
    if (match.status !== "COMPLETED" || !match.winnerId) continue;
    const loserId =
      match.winnerId === match.competitorAId
        ? match.competitorBId
        : match.winnerId === match.competitorBId
          ? match.competitorAId
          : null;

    wins.set(match.winnerId, (wins.get(match.winnerId) ?? 0) + 1);
    if (loserId) losses.set(loserId, (losses.get(loserId) ?? 0) + 1);
  }

  return competitors
    .map((c) => {
      const w = wins.get(c.id) ?? 0;
      const l = losses.get(c.id) ?? 0;
      return { competitorId: c.id, name: c.name, tag: c.tag, wins: w, losses: l, played: w + l };
    })
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
}
