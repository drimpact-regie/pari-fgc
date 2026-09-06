import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTwitchChannel } from "@/lib/normalize";
import { partnerAccessCookieName, resolveInvitationalAccess } from "@/lib/invitationalAccess";
import { assertValidOverlayBackgroundDataUrl, InvitationalOverlayImageError } from "@/lib/invitationalOverlayImage";
import { OVERLAY_ELEMENT_KEYS } from "@/lib/invitationalOverlayLayout";
import { BRACKET_OVERLAY_ELEMENT_KEYS } from "@/lib/invitationalBracketOverlayLayout";

// size optionnel (voir mergePositionedLayout : retombe sur le défaut si
// absent/invalide) — mais doit être DÉCLARÉ ici pour survivre au parsing,
// sinon zod le supprime silencieusement comme n'importe quelle clé non
// reconnue d'un z.object() (repéré en ajoutant le layout du bracket
// ci-dessous : le champ "Taille" de l'éditeur "match en cours" ne
// persistait en réalité jamais via cette route, seule la lecture avait été
// vérifiée).
const overlayPositionSchema = z.object({ x: z.number(), y: z.number(), size: z.number().positive().optional() });
const overlayLayoutSchema = z.object(
  Object.fromEntries(OVERLAY_ELEMENT_KEYS.map((key) => [key, overlayPositionSchema.optional()])),
);
const bracketOverlayLayoutSchema = z.object(
  Object.fromEntries(BRACKET_OVERLAY_ELEMENT_KEYS.map((key) => [key, overlayPositionSchema.optional()])),
);

const updateSchema = z.object({
  status: z.enum(["ACTIVE", "PAST"]).optional(),
  twitchChannel: z.string().trim().max(100).optional(),
  activeChatMatchId: z.string().trim().optional(),
  // Match affiché sur l'overlay OBS "match en cours" — désignation
  // indépendante de activeChatMatchId (voir /overlay/invitational/[eventId]/match).
  activeOverlayMatchId: z.string().trim().optional(),
  // Inverse l'affichage J1/J2 du match actuellement à l'écran (voir
  // ActiveOverlayMatchSwapButton) — toujours remis à false quand
  // activeOverlayMatchId change (voir plus bas), donc jamais envoyé en
  // même temps que ce dernier par l'UI.
  activeOverlayMatchSwapped: z.boolean().optional(),
  // Constantes du calcul d'estimation d'horaires (Rundown), reproduites
  // côté site pour l'encart "prochains matchs" de l'overlay bracket — voir
  // lib/invitationalRundown.ts.
  rundownMinSecondsPerRound: z.number().int().positive().optional(),
  rundownMaxSecondsPerRound: z.number().int().positive().optional(),
  rundownSetupSeconds: z.number().int().nonnegative().optional(),
  rundownVerifSeconds: z.number().int().nonnegative().optional(),
  rundownStartAt: z.string().trim().optional(),
  // Personnalisation de l'overlay OBS "match en cours" — voir
  // lib/invitationalOverlayLayout.ts / lib/invitationalOverlayImage.ts.
  // overlayBackgroundUrl : chaîne vide = retire le fond personnalisé.
  overlayBackgroundUrl: z.string().optional(),
  overlayLayout: overlayLayoutSchema.optional(),
  // Personnalisation de l'overlay OBS "bracket/classement" — voir
  // lib/invitationalBracketOverlayLayout.ts (positions) et
  // lib/invitationalBracketTemplate.ts (gabarit 8/16/32).
  bracketOverlayLayout: bracketOverlayLayoutSchema.optional(),
  bracketSize: z.union([z.literal(8), z.literal(16), z.literal(32)]).nullable().optional(),
});

/**
 * Accessible à l'admin, mais aussi au prestataire propriétaire de cet event
 * précis (portail self-service — voir lib/invitationalAccess.ts) : session
 * du compte propriétaire (identification Twitch) ou cookie d'accès valide
 * pour CET eventId (identification manuelle par email). Jamais de contrôle
 * plus large — un prestataire ne peut agir que sur son propre event.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const jar = await cookies();
  const access = await resolveInvitationalAccess(eventId, jar.get(partnerAccessCookieName(eventId))?.value);
  if (!access) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  let rundownStartAt: Date | null | undefined;
  if (parsed.data.rundownStartAt !== undefined) {
    if (parsed.data.rundownStartAt === "") {
      rundownStartAt = null;
    } else {
      const date = new Date(parsed.data.rundownStartAt);
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: "Heure de début invalide." }, { status: 400 });
      }
      rundownStartAt = date;
    }
  }

  if (parsed.data.overlayBackgroundUrl !== undefined) {
    try {
      assertValidOverlayBackgroundDataUrl(parsed.data.overlayBackgroundUrl);
    } catch (err) {
      const message = err instanceof InvitationalOverlayImageError ? err.message : "Image invalide.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const event = await prisma.invitationalEvent.update({
    where: { id: eventId },
    data: {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.twitchChannel !== undefined
        ? { twitchChannel: normalizeTwitchChannel(parsed.data.twitchChannel) || null }
        : {}),
      ...(parsed.data.activeChatMatchId !== undefined
        ? { activeChatMatchId: parsed.data.activeChatMatchId || null }
        : {}),
      ...(parsed.data.activeOverlayMatchId !== undefined
        ? {
            activeOverlayMatchId: parsed.data.activeOverlayMatchId || null,
            // Changer (ou retirer) le match affiché ne doit jamais hériter
            // de l'inversion J1/J2 du match précédemment désigné.
            activeOverlayMatchSwapped: false,
          }
        : {}),
      ...(parsed.data.activeOverlayMatchSwapped !== undefined
        ? { activeOverlayMatchSwapped: parsed.data.activeOverlayMatchSwapped }
        : {}),
      ...(parsed.data.rundownMinSecondsPerRound !== undefined
        ? { rundownMinSecondsPerRound: parsed.data.rundownMinSecondsPerRound }
        : {}),
      ...(parsed.data.rundownMaxSecondsPerRound !== undefined
        ? { rundownMaxSecondsPerRound: parsed.data.rundownMaxSecondsPerRound }
        : {}),
      ...(parsed.data.rundownSetupSeconds !== undefined
        ? { rundownSetupSeconds: parsed.data.rundownSetupSeconds }
        : {}),
      ...(parsed.data.rundownVerifSeconds !== undefined
        ? { rundownVerifSeconds: parsed.data.rundownVerifSeconds }
        : {}),
      ...(rundownStartAt !== undefined ? { rundownStartAt } : {}),
      ...(parsed.data.overlayBackgroundUrl !== undefined
        ? { overlayBackgroundUrl: parsed.data.overlayBackgroundUrl || null }
        : {}),
      ...(parsed.data.overlayLayout !== undefined ? { overlayLayout: parsed.data.overlayLayout } : {}),
      ...(parsed.data.bracketOverlayLayout !== undefined
        ? { bracketOverlayLayout: parsed.data.bracketOverlayLayout }
        : {}),
      ...(parsed.data.bracketSize !== undefined ? { bracketSize: parsed.data.bracketSize } : {}),
    },
  });

  return NextResponse.json({ event });
}

/**
 * Supprime un event Invitational/Prestataire, avec tout ce qui lui est
 * rattaché par relation (compétiteurs, matchs, paris — onDelete: Cascade
 * dans le schéma), contrairement aux tournois classiques dont les paris
 * sont rattachés par eventSlug et survivent à la suppression.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { eventId } = await params;
  const existing = await prisma.invitationalEvent.findUnique({ where: { id: eventId } });
  if (!existing) {
    return NextResponse.json({ error: "Event introuvable." }, { status: 404 });
  }

  await prisma.invitationalEvent.delete({ where: { id: eventId } });
  return NextResponse.json({ ok: true });
}
