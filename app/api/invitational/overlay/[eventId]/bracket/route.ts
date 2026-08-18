import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildInvitationalBracketColumns } from "@/lib/invitationalBracket";
import { buildTemplatedBracketColumns, isBracketSize } from "@/lib/invitationalBracketTemplate";
import { computeStandings } from "@/lib/invitationalStandings";
import { computeSchedule } from "@/lib/invitationalRundown";
import { mergeBracketOverlayLayout } from "@/lib/invitationalBracketOverlayLayout";
import { isInvitationalBracketFormat } from "@/lib/invitationalFormats";

function competitorView(c: { name: string; tag: string | null; countryCode: string | null } | null) {
  if (!c) return null;
  return { name: c.name, tag: c.tag, countryCode: c.countryCode };
}

function bracketMatchView(m: {
  id: string;
  competitorA: { name: string; tag: string | null; countryCode: string | null } | null;
  placeholderA: string | null;
  competitorB: { name: string; tag: string | null; countryCode: string | null } | null;
  placeholderB: string | null;
  scoreA: number | null;
  scoreB: number | null;
  status: "NOT_OPEN" | "OPEN" | "CLOSED" | "COMPLETED";
  winnerId: string | null;
  competitorAId: string | null;
  competitorBId: string | null;
}) {
  return {
    id: m.id,
    competitorA: competitorView(m.competitorA) ?? (m.placeholderA ? { name: m.placeholderA, tag: null, countryCode: null } : null),
    competitorB: competitorView(m.competitorB) ?? (m.placeholderB ? { name: m.placeholderB, tag: null, countryCode: null } : null),
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    status: m.status,
    winnerId: m.winnerId,
    competitorAId: m.competitorAId,
    competitorBId: m.competitorBId,
  };
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

  // Taille choisie (voir InvitationalEvent.bracketSize, Partie 2 du prompt
  // overlay bracket) : gabarit de colonnes/cases fixe avec vraies lignes de
  // connexion (voir lib/invitationalBracketTemplate.ts et
  // components/InvitationalBracket.tsx). Sans taille choisie, retombe sur
  // l'ancien regroupement simple (une colonne par groupLabel rencontré,
  // sans gabarit ni lignes de connexion) — comportement historique
  // inchangé pour un event pas encore configuré.
  let bracket: Array<{ key: string; label: string; side: string; matches: (ReturnType<typeof bracketMatchView> | null)[] }> | null = null;
  if (isBracketFormat) {
    bracket = isBracketSize(event.bracketSize)
      ? buildTemplatedBracketColumns(matches, event.format, event.bracketSize).map((column) => ({
          key: column.key,
          label: column.label,
          side: column.side,
          matches: column.matches.map((m) => (m ? bracketMatchView(m) : null)),
        }))
      : buildInvitationalBracketColumns(matches).map((column) => ({
          key: column.label,
          label: column.label,
          side: "legacy",
          matches: column.matches.map((m) => bracketMatchView(m)),
        }));
  }

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
