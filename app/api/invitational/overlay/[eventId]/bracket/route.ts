import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildInvitationalBracketColumns } from "@/lib/invitationalBracket";
import { computeStandings } from "@/lib/invitationalStandings";
import { computeSchedule } from "@/lib/invitationalRundown";

const BRACKET_FORMATS = new Set(["BRACKET_SINGLE", "BRACKET_DOUBLE"]);

function competitorView(c: { name: string; tag: string | null; countryCode: string | null } | null) {
  if (!c) return null;
  return { name: c.name, tag: c.tag, countryCode: c.countryCode };
}

/**
 * Endpoint public en lecture seule pour l'overlay OBS "bracket / classement"
 * (/overlay/invitational/[eventId]/bracket) — voir Partie 3 du prompt
 * overlay. Renvoie soit un arbre de bracket (formats BRACKET_SINGLE/DOUBLE),
 * soit un classement + liste de matchs (autres formats), plus les 4
 * prochains matchs avec une estimation d'horaire (même formule que le
 * Rundown Excel, voir lib/invitationalRundown.ts).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  const event = await prisma.invitationalEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event introuvable." }, { status: 404 });
  }

  const [matches, competitors] = await Promise.all([
    prisma.invitationalMatch.findMany({
      where: { eventId },
      include: { competitorA: true, competitorB: true },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.invitationalCompetitor.findMany({ where: { eventId } }),
  ]);

  const isBracketFormat = BRACKET_FORMATS.has(event.format);

  const bracket = isBracketFormat
    ? buildInvitationalBracketColumns(matches).map((column) => ({
        label: column.label,
        matches: column.matches.map((m) => ({
          id: m.id,
          competitorA: competitorView(m.competitorA) ?? (m.placeholderA ? { name: m.placeholderA, tag: null, countryCode: null } : null),
          competitorB: competitorView(m.competitorB) ?? (m.placeholderB ? { name: m.placeholderB, tag: null, countryCode: null } : null),
          scoreA: m.scoreA,
          scoreB: m.scoreB,
          status: m.status,
          winnerId: m.winnerId,
          competitorAId: m.competitorAId,
          competitorBId: m.competitorBId,
        })),
      }))
    : null;

  const standings = !isBracketFormat
    ? computeStandings(matches, competitors)
    : null;

  const matchList = !isBracketFormat
    ? matches.map((m) => ({
        id: m.id,
        groupLabel: m.groupLabel,
        competitorA: competitorView(m.competitorA) ?? (m.placeholderA ? { name: m.placeholderA, tag: null, countryCode: null } : null),
        competitorB: competitorView(m.competitorB) ?? (m.placeholderB ? { name: m.placeholderB, tag: null, countryCode: null } : null),
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        status: m.status,
      }))
    : null;

  let upcoming: Array<{
    id: string;
    groupLabel: string | null;
    competitorA: ReturnType<typeof competitorView>;
    competitorB: ReturnType<typeof competitorView>;
    startMin: string | null;
    startMax: string | null;
  }> = [];

  if (event.rundownStartAt) {
    const schedule = computeSchedule(
      matches.map((m) => ({ id: m.id, ftGames: m.ftGames, roundsPerGame: m.roundsPerGame, verifManette: m.verifManette })),
      {
        minSecondsPerRound: event.rundownMinSecondsPerRound,
        maxSecondsPerRound: event.rundownMaxSecondsPerRound,
        setupSeconds: event.rundownSetupSeconds,
        verifSeconds: event.rundownVerifSeconds,
        startAt: event.rundownStartAt,
      },
    );
    const scheduleById = new Map(schedule.map((s) => [s.id, s]));

    upcoming = matches
      .filter((m) => m.status !== "COMPLETED")
      .slice(0, 4)
      .map((m) => {
        const estimate = scheduleById.get(m.id);
        return {
          id: m.id,
          groupLabel: m.groupLabel,
          competitorA: competitorView(m.competitorA) ?? (m.placeholderA ? { name: m.placeholderA, tag: null, countryCode: null } : null),
          competitorB: competitorView(m.competitorB) ?? (m.placeholderB ? { name: m.placeholderB, tag: null, countryCode: null } : null),
          startMin: estimate?.startMin ? estimate.startMin.toISOString() : null,
          startMax: estimate?.startMax ? estimate.startMax.toISOString() : null,
        };
      });
  } else {
    upcoming = matches
      .filter((m) => m.status !== "COMPLETED")
      .slice(0, 4)
      .map((m) => ({
        id: m.id,
        groupLabel: m.groupLabel,
        competitorA: competitorView(m.competitorA) ?? (m.placeholderA ? { name: m.placeholderA, tag: null, countryCode: null } : null),
        competitorB: competitorView(m.competitorB) ?? (m.placeholderB ? { name: m.placeholderB, tag: null, countryCode: null } : null),
        startMin: null,
        startMax: null,
      }));
  }

  return NextResponse.json({
    event: { id: event.id, name: event.name, format: event.format },
    isBracketFormat,
    bracket,
    standings,
    matches: matchList,
    upcoming,
  });
}
