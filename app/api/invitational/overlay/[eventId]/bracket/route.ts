import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildInvitationalBracketColumns } from "@/lib/invitationalBracket";
import { computeStandings } from "@/lib/invitationalStandings";
import { computeSchedule } from "@/lib/invitationalRundown";
import { mergeBracketOverlayLayout } from "@/lib/invitationalBracketOverlayLayout";
import { isInvitationalBracketFormat } from "@/lib/invitationalFormats";

function competitorView(c: { name: string; tag: string | null; countryCode: string | null } | null) {
  if (!c) return null;
  return { name: c.name, tag: c.tag, countryCode: c.countryCode };
}

/**
 * Nombre de prochains matchs / gagnants de paris récents renvoyés pour le
 * bandeau défilant du bas de l'overlay (voir components/overlay/OverlayBracketView.tsx)
 * — un simple panneau fixe n'en affichait que 4 (assez pour tenir sans
 * scroll) ; un bandeau qui défile peut en montrer bien plus sans jamais
 * paraître vide même en fin d'event, quand peu de matchs restent à venir.
 */
const TICKER_ITEM_LIMIT = 10;

/**
 * Endpoint public en lecture seule pour l'overlay OBS "bracket / classement"
 * (/overlay/invitational/[eventId]/bracket) — voir Partie 3 du prompt
 * overlay. Renvoie soit un arbre de bracket (formats BRACKET_SINGLE/DOUBLE),
 * soit un classement + liste de matchs (autres formats), plus les prochains
 * matchs avec une estimation d'horaire (même formule que le Rundown Excel,
 * voir lib/invitationalRundown.ts) et les gagnants de paris récents — les
 * deux alimentent le bandeau défilant du bas de l'overlay.
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

  const isBracketFormat = isInvitationalBracketFormat(event.format);

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
      .slice(0, TICKER_ITEM_LIMIT)
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
      .slice(0, TICKER_ITEM_LIMIT)
      .map((m) => ({
        id: m.id,
        groupLabel: m.groupLabel,
        competitorA: competitorView(m.competitorA) ?? (m.placeholderA ? { name: m.placeholderA, tag: null, countryCode: null } : null),
        competitorB: competitorView(m.competitorB) ?? (m.placeholderB ? { name: m.placeholderB, tag: null, countryCode: null } : null),
        startMin: null,
        startMax: null,
      }));
  }

  // Gagnants de paris récents, pour le bandeau défilant — aucune donnée
  // personnelle affichée : le pseudo (site, ou pseudo Twitch si le compte
  // vient d'un lien Twitch — voir lib/users.ts, ensureUserByTwitchId
  // initialise déjà `username` avec le pseudo Twitch à la création du
  // compte) et le montant gagné, déjà publics via le classement/l'historique
  // de paris. predictedCompetitorName est un instantané pris au moment du
  // pari (voir schema.prisma) : reste correct même si le nom du compétiteur
  // a changé depuis côté InvitationalCompetitor.
  const recentWinners = await prisma.invitationalBet.findMany({
    where: { eventId, status: "WON" },
    orderBy: { resolvedAt: "desc" },
    take: TICKER_ITEM_LIMIT,
    include: {
      user: { select: { username: true } },
      match: { select: { groupLabel: true, competitorA: true, competitorB: true } },
    },
  });

  return NextResponse.json({
    event: { id: event.id, name: event.name, format: event.format },
    isBracketFormat,
    bracket,
    standings,
    matches: matchList,
    upcoming,
    recentWinners: recentWinners.map((bet) => ({
      id: bet.id,
      username: bet.user.username,
      predictedCompetitorName: bet.predictedCompetitorName,
      pointsAwarded: bet.pointsAwarded,
      matchGroupLabel: bet.match.groupLabel,
      competitorA: competitorView(bet.match.competitorA),
      competitorB: competitorView(bet.match.competitorB),
    })),
    bracketOverlayLayout: mergeBracketOverlayLayout(event.bracketOverlayLayout),
  });
}
