import type { InvitationalEvent } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildCompetitorRoster,
  type ParsedInvitationalImport,
} from "@/lib/invitationalImport";

export async function listInvitationalEvents(): Promise<InvitationalEvent[]> {
  return prisma.invitationalEvent.findMany({ orderBy: { eventDate: "desc" } });
}

export async function getInvitationalEvent(id: string): Promise<InvitationalEvent | null> {
  return prisma.invitationalEvent.findUnique({ where: { id } });
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
  const roster = buildCompetitorRoster(input.parsed.matches);

  return prisma.$transaction(async (tx) => {
    const event = await tx.invitationalEvent.create({
      data: { name: input.name, eventDate: input.eventDate, format: input.parsed.format },
    });

    const competitorIdByName = new Map<string, string>();
    for (const competitor of roster) {
      const created = await tx.invitationalCompetitor.create({
        data: {
          eventId: event.id,
          name: competitor.name,
          tag: competitor.tag,
          countryCode: competitor.countryCode,
        },
      });
      competitorIdByName.set(normalizeCompetitorKey(competitor.name), created.id);
    }

    for (const match of input.parsed.matches) {
      await tx.invitationalMatch.create({
        data: {
          eventId: event.id,
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

    return event;
  });
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
