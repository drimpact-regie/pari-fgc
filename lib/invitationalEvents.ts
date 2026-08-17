import type { InvitationalEvent, InvitationalFormat, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildCompetitorRoster,
  InvitationalImportError,
  type ParsedInvitationalImport,
} from "@/lib/invitationalImport";

export async function listInvitationalEvents(): Promise<InvitationalEvent[]> {
  return prisma.invitationalEvent.findMany({ orderBy: { eventDate: "desc" } });
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
export async function createInvitationalEvent(input: {
  name: string;
  eventDate: Date;
  parsed: ParsedInvitationalImport;
}): Promise<InvitationalEvent> {
  return prisma.$transaction(async (tx) => {
    const event = await tx.invitationalEvent.create({
      data: { name: input.name, eventDate: input.eventDate, format: input.parsed.format },
    });
    await populateEventMatches(tx, event.id, input.parsed);
    return event;
  });
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
 * Un ré-import (event qui a déjà des matchs) repart entièrement de zéro :
 * les matchs et compétiteurs existants sont supprimés puis recréés depuis
 * le nouveau fichier, ce qui annule au passage (suppression en cascade) les
 * paris déjà placés dessus — pensé pour corriger un fichier erroné avant le
 * début du show, pas pour fusionner deux versions en cours d'event.
 */
export async function importMatchesIntoInvitationalEvent(
  eventId: string,
  expectedFormat: InvitationalFormat,
  parsed: ParsedInvitationalImport,
): Promise<void> {
  if (parsed.format !== expectedFormat) {
    throw new InvitationalImportError(
      `Ce fichier est un modèle "${parsed.format}" mais votre event a été confirmé au format ` +
        `"${expectedFormat}". Le changement de format n'est pas possible en self-service, contactez un admin.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.invitationalMatch.deleteMany({ where: { eventId } });
    await tx.invitationalCompetitor.deleteMany({ where: { eventId } });
    await populateEventMatches(tx, eventId, parsed);
  });
}

/**
 * Crée les compétiteurs dédupliqués par nom (buildCompetitorRoster) puis
 * tous les matchs en référençant les bons compétiteurs — factorisé entre
 * createInvitationalEvent (création admin) et importMatchesIntoInvitationalEvent
 * (import/ré-import self-service prestataire), toujours dans la transaction
 * de l'appelant pour ne jamais laisser un event à moitié importé si quelque
 * chose échoue en cours de route.
 */
async function populateEventMatches(
  tx: Prisma.TransactionClient,
  eventId: string,
  parsed: ParsedInvitationalImport,
): Promise<void> {
  const roster = buildCompetitorRoster(parsed.matches);

  const competitorIdByName = new Map<string, string>();
  for (const competitor of roster) {
    const created = await tx.invitationalCompetitor.create({
      data: {
        eventId,
        name: competitor.name,
        tag: competitor.tag,
        countryCode: competitor.countryCode,
      },
    });
    competitorIdByName.set(normalizeCompetitorKey(competitor.name), created.id);
  }

  for (const match of parsed.matches) {
    await tx.invitationalMatch.create({
      data: {
        eventId,
        groupLabel: match.groupLabel,
        orderIndex: match.orderIndex,
        competitorAId: match.competitorA
          ? competitorIdByName.get(normalizeCompetitorKey(match.competitorA.name))
          : null,
        placeholderA: match.placeholderA,
        competitorBId: match.competitorB
          ? competitorIdByName.get(normalizeCompetitorKey(match.competitorB.name))
          : null,
        placeholderB: match.placeholderB,
        ftGames: match.ftGames,
        roundsPerGame: match.roundsPerGame,
        verifManette: match.verifManette,
      },
    });
  }
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
