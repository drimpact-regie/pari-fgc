import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import InvitationalMatchRow from "@/components/InvitationalMatchRow";
import InvitationalTwitchChannelEditor from "@/components/InvitationalTwitchChannelEditor";
import InvitationalOverlaySettings from "@/components/InvitationalOverlaySettings";
import InvitationalOverlayLayoutEditor from "@/components/InvitationalOverlayLayoutEditor";
import PartnerInvitationalImportForm from "@/components/PartnerInvitationalImportForm";
import { mergeOverlayLayout } from "@/lib/invitationalOverlayLayout";
import { INVITATIONAL_TEMPLATE_FILENAMES } from "@/lib/invitationalTemplates";

export const dynamic = "force-dynamic";

const FORMAT_LABELS: Record<string, string> = {
  BRACKET_SINGLE: "Bracket simple élimination",
  BRACKET_DOUBLE: "Bracket double élimination",
  ROUND_ROBIN: "Round robin",
  SWISS: "Suisse",
  POOLS: "Poules",
  LIST: "Liste de matchs",
};

export default async function AdminInvitationalEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const { eventId } = await params;
  const event = await prisma.invitationalEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    notFound();
  }

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
        <Link href="/admin/invitational" className="text-xs underline" style={{ color: "var(--accent)" }}>
          ← Tous les events
        </Link>
        <h1 className="text-xl font-semibold mt-1">{event.name}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          {new Date(event.eventDate).toLocaleDateString("fr-FR")} · {FORMAT_LABELS[event.format] ?? event.format} ·{" "}
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

      {matches.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Aucun match importé pour cet event.
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
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
