import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

type Tab = "matchs" | "overlay";

function TabLink({ eventId, tab, active, children }: { eventId: string; tab: Tab; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={tab === "matchs" ? `/admin/invitational/${eventId}` : `/admin/invitational/${eventId}?tab=${tab}`}
      className="px-3 py-2 text-sm"
      style={{
        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
        color: active ? "var(--accent)" : "var(--muted)",
      }}
    >
      {children}
    </Link>
  );
}

export default async function AdminInvitationalEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const { eventId } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = rawTab === "overlay" ? "overlay" : "matchs";

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

      {/* Un event "mode régie" (voir Tournament.regieEvent) reçoit ses matchs
          exclusivement depuis start.gg — aucun fichier à importer. */}
      {!event.linkedTournamentId && (
        <PartnerInvitationalImportForm
          eventId={event.id}
          templateUrl={`/templates/invitational/${INVITATIONAL_TEMPLATE_FILENAMES[event.format]}`}
          hasMatches={matches.length > 0}
        />
      )}

      <div className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
        <TabLink eventId={event.id} tab="matchs" active={tab === "matchs"}>
          Matchs
        </TabLink>
        <TabLink eventId={event.id} tab="overlay" active={tab === "overlay"}>
          Calcage overlay
        </TabLink>
      </div>

      {tab === "matchs" ? (
        <>
          <div className="card p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Chaîne Twitch (pari via chat)</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                Réutilise le bot Twitch déjà connecté pour les tournois classiques.
              </p>
            </div>
            <InvitationalTwitchChannelEditor eventId={event.id} initialChannel={event.twitchChannel} />
          </div>

          {matches.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Aucun match importé pour cet event.
            </p>
          ) : (
            Array.from(groups.entries()).map(([groupLabel, groupMatches]) => {
              // "Prêt" = au moins un adversaire déjà déterminé (ou déjà
              // ouvert/joué) — un round encore 100% "À déterminer" des deux
              // côtés est replié par défaut plutôt que d'encombrer l'écran
              // (repéré sur un bracket à 97 matchs, la plupart encore TBD).
              const readyCount = groupMatches.filter(
                (m) => m.status !== "NOT_OPEN" || m.competitorA || m.competitorB,
              ).length;
              return (
                <details key={groupLabel || "__default"} open={readyCount > 0} className="flex flex-col gap-3">
                  <summary className="text-sm font-semibold cursor-pointer">
                    {groupLabel || "Matchs"} — {readyCount}/{groupMatches.length} prêt
                    {readyCount > 1 ? "s" : ""}
                  </summary>
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
                </details>
              );
            })
          )}
        </>
      ) : (
        <>
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

          {isInvitationalBracketFormat(event.format) && (
            <InvitationalBracketSizeEditor eventId={event.id} initialSize={event.bracketSize} />
          )}

          {/* "bracket" (arbre entier) pour les formats bracket, "standings"/
              "matchList" pour les autres — voir lib/invitationalBracketOverlayLayout.ts. */}
          <InvitationalBracketOverlayLayoutEditor
            eventId={event.id}
            initialLayout={mergeBracketOverlayLayout(event.bracketOverlayLayout)}
          />
        </>
      )}
    </div>
  );
}
