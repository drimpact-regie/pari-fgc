import { prisma } from "@/lib/prisma";
import { getStreamQueue, tournamentSlugFromEventSlug } from "@/lib/startgg";
import ActiveOverlayMatchButton from "@/components/ActiveOverlayMatchButton";

/**
 * File d'attente stream start.gg (Streams > Stream Queue côté organisateur)
 * pour ce tournoi : permet de préparer/activer le prochain match sur
 * l'overlay régie sans avoir à le chercher dans tout le bracket. Champ
 * GraphQL non documenté publiquement, non vérifié contre l'API réelle
 * depuis cet environnement — voir getStreamQueue (lib/startgg.ts). En
 * best-effort : une absence de résultat (champ inexistant, aucun stream
 * configuré côté start.gg, erreur réseau) masque simplement le panneau
 * plutôt que de casser la page régie.
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
  if (queuedSetIds.length === 0) return null;

  const matches = await prisma.invitationalMatch.findMany({
    where: { eventId: regieEventId, startggSetId: { in: queuedSetIds } },
    select: { id: true, startggSetId: true },
  });
  const matchIdBySetId = new Map(matches.map((m) => [m.startggSetId as string, m.id]));

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold">File d&apos;attente stream (start.gg)</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Ce que l&apos;organisateur a placé en file sur chaque stream côté start.gg — clique pour
          l&apos;afficher directement sur l&apos;overlay &quot;match en cours&quot;.
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
