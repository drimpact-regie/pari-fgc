import type { InvitationalEvent, InvitationalFormat, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  InvitationalImportError,
  type ParsedCompetitor,
  type ParsedInvitationalImport,
} from "@/lib/invitationalImport";

/**
 * Exclut les events "mode régie" (voir InvitationalEvent.linkedTournamentId)
 * : ce sont des coquilles internes réutilisant le modèle de données
 * Invitational pour un tournoi start.gg, jamais des events
 * Invitational/Prestataire réels — ils n'ont rien à faire dans la liste
 * publique ni dans la liste admin, gérés depuis la page du tournoi qui les
 * a créés (voir lib/tournamentRegie.ts).
 */
export async function listInvitationalEvents(): Promise<InvitationalEvent[]> {
  return prisma.invitationalEvent.findMany({
    where: { linkedTournamentId: null },
    orderBy: { eventDate: "desc" },
  });
}

export async function getInvitationalEvent(id: string): Promise<InvitationalEvent | null> {
  return prisma.invitationalEvent.findUnique({ where: { id } });
}

/** Tous les events dont ce compte est le prestataire propriétaire (portail self-service, identification Twitch). */
export async function listInvitationalEventsForOwner(ownerUserId: string): Promise<InvitationalEvent[]> {
  return prisma.invitationalEvent.findMany({
    where: { ownerUserId },
    orderBy: { eventDate: "desc" },
  });
}

/**
 * Crée un event Invitational/Prestataire à partir d'un import déjà parsé
 * (voir lib/invitationalImport.ts) : l'event, tous les compétiteurs
 * dédupliqués par nom (buildCompetitorRoster), puis tous les matchs en
 * référençant les bons compétiteurs — dans une seule transaction, pour ne
 * jamais laisser un event à moitié importé si quelque chose échoue en
 * cours de route.
 */
// Défaut Prisma (5s) trop court pour un import "mode régie" d'un bracket
// complet (jusqu'à plusieurs dizaines de matchs, un create/update
// séquentiel par match — voir populateOrMergeEventMatches) : un import
// Excel Invitational classique reste largement dans les clous, mais un gros
// tournoi start.gg dépassait le délai, la transaction se faisant fermer par
// la base en cours de route (message Prisma trompeur : erreur "transaction
// not found" plutôt qu'un timeout explicite).
const LARGE_IMPORT_TRANSACTION_OPTIONS = { timeout: 60_000, maxWait: 10_000 };

export async function createInvitationalEvent(input: {
  name: string;
  eventDate: Date;
  parsed: ParsedInvitationalImport;
  /** Mode régie (voir lib/tournamentRegie.ts) : lie cet event au Tournament start.gg dont il reprend le bracket. */
  linkedTournamentId?: string;
}): Promise<InvitationalEvent> {
  return prisma.$transaction(
    async (tx) => {
      const event = await tx.invitationalEvent.create({
        data: {
          name: input.name,
          eventDate: input.eventDate,
          format: input.parsed.format,
          linkedTournamentId: input.linkedTournamentId,
        },
      });
      await populateOrMergeEventMatches(tx, event.id, input.parsed);
      return event;
    },
    LARGE_IMPORT_TRANSACTION_OPTIONS,
  );
}

/**
 * Crée l'event "coquille" (sans compétiteurs ni matchs) au moment de la
 * confirmation d'une demande self-service (voir
 * lib/invitationalRequests.ts) : les matchs ne sont importés qu'ensuite,
 * par le prestataire lui-même via importMatchesIntoInvitationalEvent, pas
 * par un admin à la création comme pour createInvitationalEvent.
 */
export async function createEmptyInvitationalEvent(input: {
  name: string;
  eventDate: Date;
  format: InvitationalFormat;
  twitchChannel: string | null;
  requestId: string;
  ownerUserId: string | null;
  partnerAccessToken: string | null;
}): Promise<InvitationalEvent> {
  return prisma.invitationalEvent.create({
    data: {
      name: input.name,
      eventDate: input.eventDate,
      format: input.format,
      twitchChannel: input.twitchChannel,
      requestId: input.requestId,
      ownerUserId: input.ownerUserId,
      partnerAccessToken: input.partnerAccessToken,
    },
  });
}

export interface InvitationalImportSummary {
  created: number;
  updated: number;
  skippedLocked: number;
}

/**
 * (Ré)importe les matchs d'un fichier dans un event déjà créé — remplace,
 * côté portail self-service prestataire, l'étape où c'était l'admin qui
 * importait le fichier initial à la création de l'event (voir
 * createInvitationalEvent). `expectedFormat` est le format fixé pour
 * l'event à la confirmation de la demande (voir
 * lib/invitationalRequests.ts) : un fichier d'un autre format est rejeté
 * plutôt que d'écraser silencieusement le format de l'event — aucune route
 * self-service ne permet de le changer, ça reste un geste admin.
 *
 * Un ré-import FUSIONNE avec les matchs déjà présents plutôt que de tout
 * remplacer (voir populateOrMergeEventMatches) : jamais de perte de score
 * déjà saisi, de compétiteur déjà identifié, ni des paris déjà placés sur
 * un match en cours/joué.
 */
export async function importMatchesIntoInvitationalEvent(
  eventId: string,
  expectedFormat: InvitationalFormat,
  parsed: ParsedInvitationalImport,
): Promise<InvitationalImportSummary> {
  if (parsed.format !== expectedFormat) {
    throw new InvitationalImportError(
      `Ce fichier est un modèle "${parsed.format}" mais votre event a été confirmé au format ` +
        `"${expectedFormat}". Le changement de format n'est pas possible en self-service, contactez un admin.`,
    );
  }

  return prisma.$transaction(
    (tx) => populateOrMergeEventMatches(tx, eventId, parsed),
    LARGE_IMPORT_TRANSACTION_OPTIONS,
  );
}

/**
 * Fusionne un import (parsé depuis un fichier) avec les matchs déjà
 * présents pour l'event — factorisé entre createInvitationalEvent (event
 * flambant neuf, donc sans effet de bord : tout est "créé") et
 * importMatchesIntoInvitationalEvent (ré-import self-service prestataire,
 * où la fusion protège la progression déjà faite), toujours dans la
 * transaction de l'appelant pour ne jamais laisser un event à moitié
 * importé si quelque chose échoue en cours de route.
 *
 * Appariement d'un match du fichier à un match existant par (groupLabel,
 * orderIndex) normalisés — la seule paire stable dans les données d'import
 * (voir lib/invitationalImport.ts : aucun identifiant technique par ligne
 * n'existe). Un match apparié DÉJÀ EN COURS OU JOUÉ (status != NOT_OPEN, ou
 * score/vainqueur déjà renseigné) n'est jamais modifié par le réimport —
 * ni ses compétiteurs (y compris un TBD_ déjà résolu en vrai nom), ni son
 * format FT/rounds — pour ne jamais perdre une progression déjà faite ni
 * invalider les paris qui référencent ce match. Un match encore NOT_OPEN et
 * sans score, en revanche, est entièrement resynchronisé depuis le fichier
 * (nom/tag/pays, FT, rounds, vérif manette) : pensé pour corriger une
 * erreur de saisie avant que le match ne commence. Un match du fichier sans
 * correspondance existante est ajouté ; un match existant absent du
 * nouveau fichier est conservé tel quel (jamais supprimé par un réimport —
 * fusion, pas remplacement total).
 *
 * Les compétiteurs sont résolus par nom normalisé en réutilisant ceux déjà
 * présents pour l'event (y compris ceux créés plus tôt dans CE même import,
 * pour un nom apparaissant sur plusieurs matchs) plutôt qu'en recréant un
 * doublon à chaque match — nécessaire pour que la série de victoires d'un
 * joueur (lib/invitationalOdds.ts) reste cumulée sur une seule entrée.
 */
async function populateOrMergeEventMatches(
  tx: Prisma.TransactionClient,
  eventId: string,
  parsed: ParsedInvitationalImport,
): Promise<InvitationalImportSummary> {
  const [existingMatches, existingCompetitors] = await Promise.all([
    tx.invitationalMatch.findMany({ where: { eventId } }),
    tx.invitationalCompetitor.findMany({ where: { eventId } }),
  ]);

  const existingMatchByKey = new Map<string, (typeof existingMatches)[number]>();
  // Un match "mode régie" se retrouve d'abord par son startggSetId (stable,
  // indépendant de orderIndex) plutôt que par (groupLabel, orderIndex) : ce
  // dernier a changé de sens en cours de route (voir buildRegieMatchesFromSets,
  // qui utilisait un index local par round avant correction) — matcher
  // uniquement par la clé aurait fait passer une resynchronisation pour un
  // import "tout nouveau" et créé des doublons plutôt que de mettre à jour
  // les matchs existants.
  const existingMatchBySetId = new Map<string, (typeof existingMatches)[number]>();
  for (const match of existingMatches) {
    existingMatchByKey.set(matchImportKey(match.groupLabel, match.orderIndex), match);
    if (match.startggSetId) existingMatchBySetId.set(match.startggSetId, match);
  }

  const competitorIdByName = new Map<string, string>();
  for (const competitor of existingCompetitors) {
    competitorIdByName.set(normalizeCompetitorKey(competitor.name), competitor.id);
  }

  async function resolveCompetitorId(competitor: ParsedCompetitor | null): Promise<string | null> {
    if (!competitor) return null;
    const key = normalizeCompetitorKey(competitor.name);
    const existingId = competitorIdByName.get(key);
    if (existingId) return existingId;
    const created = await tx.invitationalCompetitor.create({
      data: { eventId, name: competitor.name, tag: competitor.tag, countryCode: competitor.countryCode },
    });
    competitorIdByName.set(key, created.id);
    return created.id;
  }

  const summary: InvitationalImportSummary = { created: 0, updated: 0, skippedLocked: 0 };

  for (const match of parsed.matches) {
    const key = matchImportKey(match.groupLabel, match.orderIndex);
    const existing = match.startggSetId
      ? (existingMatchBySetId.get(match.startggSetId) ?? existingMatchByKey.get(key))
      : existingMatchByKey.get(key);

    if (existing) {
      const locked =
        existing.status !== "NOT_OPEN" ||
        existing.scoreA != null ||
        existing.scoreB != null ||
        existing.winnerId != null;
      if (locked) {
        summary.skippedLocked++;
        continue;
      }

      const [competitorAId, competitorBId] = await Promise.all([
        resolveCompetitorId(match.competitorA),
        resolveCompetitorId(match.competitorB),
      ]);
      await tx.invitationalMatch.update({
        where: { id: existing.id },
        data: {
          groupLabel: match.groupLabel,
          orderIndex: match.orderIndex,
          competitorAId,
          placeholderA: match.placeholderA,
          competitorBId,
          placeholderB: match.placeholderB,
          ftGames: match.ftGames,
          roundsPerGame: match.roundsPerGame,
          verifManette: match.verifManette,
          startggSetId: match.startggSetId,
        },
      });
      summary.updated++;
    } else {
      const [competitorAId, competitorBId] = await Promise.all([
        resolveCompetitorId(match.competitorA),
        resolveCompetitorId(match.competitorB),
      ]);
      await tx.invitationalMatch.create({
        data: {
          eventId,
          groupLabel: match.groupLabel,
          orderIndex: match.orderIndex,
          competitorAId,
          placeholderA: match.placeholderA,
          competitorBId,
          placeholderB: match.placeholderB,
          ftGames: match.ftGames,
          roundsPerGame: match.roundsPerGame,
          verifManette: match.verifManette,
          startggSetId: match.startggSetId,
        },
      });
      summary.created++;
    }
  }

  return summary;
}

function matchImportKey(groupLabel: string | null, orderIndex: number): string {
  return `${normalizeCompetitorKey(groupLabel ?? "")}::${orderIndex}`;
}

function normalizeCompetitorKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Trouve un compétiteur existant de cet event par nom normalisé, sinon en
 * crée un nouveau. Utilisé pour renseigner un slot "TBD_..." après coup
 * (voir app/api/admin/invitational/matches/[matchId]/route.ts) : résoudre
 * un placeholder vers un joueur déjà présent ailleurs dans l'event (ex. le
 * vainqueur d'un tour précédent, déjà créé lors de son premier match) doit
 * réutiliser le même compétiteur plutôt qu'en créer un doublon — sinon sa
 * série de victoires (lib/invitationalOdds.ts) se retrouverait scindée
 * entre deux entrées distinctes.
 */
export async function findOrCreateEventCompetitor(
  eventId: string,
  input: { name: string; tag: string | null; countryCode: string | null },
): Promise<{ id: string }> {
  const key = normalizeCompetitorKey(input.name);
  const existing = await prisma.invitationalCompetitor.findMany({ where: { eventId } });
  const match = existing.find((c) => normalizeCompetitorKey(c.name) === key);
  if (match) return { id: match.id };

  const created = await prisma.invitationalCompetitor.create({
    data: { eventId, name: input.name, tag: input.tag, countryCode: input.countryCode },
  });
  return { id: created.id };
}
