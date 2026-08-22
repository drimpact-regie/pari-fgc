import Link from "next/link";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { partnerAccessCookieName, resolveInvitationalAccess } from "@/lib/invitationalAccess";
import { INVITATIONAL_FORMAT_LABELS } from "@/lib/invitationalFormats";
import { INVITATIONAL_TEMPLATE_FILENAMES } from "@/lib/invitationalTemplates";
import InvitationalMatchRow from "@/components/InvitationalMatchRow";
import InvitationalTwitchChannelEditor from "@/components/InvitationalTwitchChannelEditor";
import InvitationalOverlaySettings from "@/components/InvitationalOverlaySettings";
import InvitationalOverlayLayoutEditor from "@/components/InvitationalOverlayLayoutEditor";
import InvitationalBracketOverlayLayoutEditor from "@/components/InvitationalBracketOverlayLayoutEditor";
import InvitationalBracketSizeEditor from "@/components/InvitationalBracketSizeEditor";
import PartnerInvitationalImportForm from "@/components/PartnerInvitationalImportForm";
import { mergeOverlayLayout } from "@/lib/invitationalOverlayLayout";
import { mergeBracketOverlayLayout } from "@/lib/invitationalBracketOverlayLayout";
import { isInvitationalBracketFormat } from "@/lib/invitationalFormats";

export const dynamic = "force-dynamic";

export default async function PartnerInvitationalEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const jar = await cookies();
  const access = await resolveInvitationalAccess(eventId, jar.get(partnerAccessCookieName(eventId))?.value);

  if (!access) {
    return (
      <div className="card p-6 max-w-md">
        <p className="text-sm font-semibold">Accès non autorisé</p>
        <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
          Vous n&apos;avez pas accès à cet event. Si vous avez reçu un lien d&apos;accès par email,
          utilisez-le directement — s&apos;il ne fonctionne plus, contactez un admin.
        </p>
      </div>
    );
  }

  const { event } = access;

  const matches = await prisma.invitationalMatch.findMany({
    where: { eventId },
    include: { competitorA: true, competitorB: true },
    orderBy: [{ groupLabel: "asc" }, { orderIndex: "asc" }],
  });

  const groups = new Map<string, typeof matches>();
  for (const match of matches) {
    const key = match.groupLabel ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(match);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {access.isOwner && (
          <Link href="/partner/invitational" className="text-xs underline" style={{ color: "var(--accent)" }}>
            ← Mes events
          </Link>
        )}
        <h1 className="text-xl font-semibold mt-1">{event.name}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          {new Date(event.eventDate).toLocaleDateString("fr-FR")} · {INVITATIONAL_FORMAT_LABELS[event.format] ?? event.format} ·{" "}
          {matches.length} match{matches.length > 1 ? "s" : ""}
        </p>
      </div>

      <PartnerInvitationalImportForm
        eventId={event.id}
        templateUrl={`/templates/invitational/${INVITATIONAL_TEMPLATE_FILENAMES[event.format]}`}
        hasMatches={matches.length > 0}
      />

      <div className="card p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Chaîne Twitch (pari via chat)</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Réutilise le bot Twitch déjà connecté pour les tournois classiques.
          </p>
        </div>
        <InvitationalTwitchChannelEditor eventId={event.id} initialChannel={event.twitchChannel} />
      </div>

      <InvitationalOverlaySettings
        eventId={event.id}
        config={{
          rundownMinSecondsPerRound: event.rundownMinSecondsPerRound,
          rundownMaxSecondsPerRound: event.rundownMaxSecondsPerRound,
          rundownSetupSeconds: event.rundownSetupSeconds,
          rundownVerifSeconds: event.rundownVerifSeconds,
          rundownStartAt: event.rundownStartAt,
        }}
      />

      <InvitationalOverlayLayoutEditor
        eventId={event.id}
        initialBackgroundUrl={event.overlayBackgroundUrl}
        initialLayout={mergeOverlayLayout(event.overlayLayout)}
      />

      {isInvitationalBracketFormat(event.format) ? (
        <InvitationalBracketSizeEditor eventId={event.id} initialSize={event.bracketSize} />
      ) : (
        <InvitationalBracketOverlayLayoutEditor
          eventId={event.id}
          initialLayout={mergeBracketOverlayLayout(event.bracketOverlayLayout)}
        />
      )}

      {matches.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Aucun match importé pour l&apos;instant — téléchargez le modèle ci-dessus, remplissez-le,
          puis importez-le.
        </p>
      ) : (
        Array.from(groups.entries()).map(([groupLabel, groupMatches]) => (
          <div key={groupLabel || "__default"} className="flex flex-col gap-3">
            {groupLabel && <h2 className="text-sm font-semibold">{groupLabel}</h2>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {groupMatches.map((m) => (
                <InvitationalMatchRow
                  key={m.id}
                  match={m}
                  eventId={event.id}
                  showChatButton={Boolean(event.twitchChannel)}
                  isActiveChatMatch={event.activeChatMatchId === m.id}
                  isActiveOverlayMatch={event.activeOverlayMatchId === m.id}
                  isActiveOverlayMatchSwapped={event.activeOverlayMatchSwapped}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
