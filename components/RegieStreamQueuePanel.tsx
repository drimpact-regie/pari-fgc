import { prisma } from "@/lib/prisma";
import { getStreamQueue, tournamentSlugFromEventSlug } from "@/lib/startgg";
import ActiveOverlayMatchButton from "@/components/ActiveOverlayMatchButton";

/**
 * "Match en cours en stream" : d'abord la file d'attente stream start.gg
 * (Streams > Stream Queue côté organisateur, voir getStreamQueue dans
 * lib/startgg.ts — champ GraphQL non documenté publiquement, non vérifié
 * contre l'API réelle depuis cet environnement) si elle existe et n'est
 * pas vide ; sinon repli sur la liste manuelle de tous les matchs déjà
 * importés (noms de joueurs déjà repris de start.gg), pour pouvoir
 * désigner le match actif à la main quand l'organisateur n'a configuré
 * aucun stream côté start.gg.
 */
export default async function RegieStreamQueuePanel({
  eventSlug,
  regieEventId,
  activeOverlayMatchId,
}: {
  eventSlug: string;
  regieEventId: string;
  activeOverlayMatchId: string | null;
}) {
  const streams = await getStreamQueue(tournamentSlugFromEventSlug(eventSlug)).catch(() => []);
  const queuedSetIds = streams.flatMap((s) => s.sets.map((set) => set.id));
  const hasQueue = queuedSetIds.length > 0;

  if (hasQueue) {
    const matches = await prisma.invitationalMatch.findMany({
      where: { eventId: regieEventId, startggSetId: { in: queuedSetIds } },
      select: { id: true, startggSetId: true },
    });
    const matchIdBySetId = new Map(matches.map((m) => [m.startggSetId as string, m.id]));

    return (
      <div className="card p-4 flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold">Match en cours en stream</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            File d&apos;attente placée par l&apos;organisateur sur start.gg — clique pour afficher
            directement un match sur l&apos;overlay &quot;match en cours&quot;.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {streams.map((stream) => (
            <div key={stream.streamId} className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gold)" }}>
                {stream.streamName}
              </p>
              {stream.sets.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  File vide.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {stream.sets.map((set) => {
                    const matchId = matchIdBySetId.get(set.id);
                    const label = `${set.fullRoundText} — ${set.slots.map((s) => s.entrantName ?? "?").join(" vs ")}`;
                    return (
                      <div key={set.id} className="flex items-center justify-between gap-2 text-sm">
                        <span>{label}</span>
                        {matchId ? (
                          <ActiveOverlayMatchButton
                            eventId={regieEventId}
                            matchId={matchId}
                            active={activeOverlayMatchId === matchId}
                          />
                        ) : (
                          <span className="text-xs" style={{ color: "var(--muted)" }}>
                            Pas encore importé
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Repli manuel : aucune file d'attente stream côté start.gg (pas
  // configurée, ou champ indisponible) — liste tous les matchs pas encore
  // joués, avec les noms déjà connus, pour choisir à la main.
  const matches = await prisma.invitationalMatch.findMany({
    where: { eventId: regieEventId, status: { not: "COMPLETED" } },
    include: { competitorA: true, competitorB: true },
    orderBy: { orderIndex: "asc" },
  });

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold">Match en cours en stream</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Aucune file d&apos;attente stream trouvée côté start.gg — choisis le match à la main.
        </p>
      </div>
      {matches.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Aucun match en attente.
        </p>
      ) : (
        <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
          {matches.map((m) => {
            const nameA = m.competitorA?.name ?? m.placeholderA ?? "?";
            const nameB = m.competitorB?.name ?? m.placeholderB ?? "?";
            return (
              <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {m.groupLabel ? `${m.groupLabel} — ` : ""}
                  {nameA} vs {nameB}
                </span>
                <ActiveOverlayMatchButton
                  eventId={regieEventId}
                  matchId={m.id}
                  active={activeOverlayMatchId === m.id}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
