import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listInvitationalEvents } from "@/lib/invitationalEvents";

export const dynamic = "force-dynamic";

const FORMAT_LABELS: Record<string, string> = {
  BRACKET_SINGLE: "Bracket simple élimination",
  BRACKET_DOUBLE: "Bracket double élimination",
  ROUND_ROBIN: "Round robin",
  SWISS: "Suisse",
  POOLS: "Poules",
  LIST: "Liste de matchs",
};

export default async function InvitationalHomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?from=%2Finvitational");
  }

  const [events, currentUser] = await Promise.all([
    listInvitationalEvents(),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { invitationalExBalance: true } }),
  ]);
  const activeEvents = events.filter((e) => e.status === "ACTIVE");
  const pastEvents = events.filter((e) => e.status === "PAST");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Invitational / Prestataire</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Showmatchs, exhibitions et weeklies invités — économie et classement séparés du reste
            du site.
          </p>
        </div>
        <span className="font-semibold" style={{ color: "var(--gold)" }}>
          {currentUser?.invitationalExBalance ?? 0} Ex
        </span>
      </div>

      <EventList title="Events actifs" events={activeEvents} emptyLabel="Aucun event actif pour le moment." />
      <EventList title="Events passés" events={pastEvents} emptyLabel="Aucun event passé." />
    </div>
  );
}

function EventList({
  title,
  events,
  emptyLabel,
}: {
  title: string;
  events: Awaited<ReturnType<typeof listInvitationalEvents>>;
  emptyLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {events.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {emptyLabel}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((e) => (
            <Link key={e.id} href={`/invitational/${e.id}`} className="card p-4 flex items-center justify-between gap-3 hover:opacity-90">
              <div>
                <p className="font-medium">{e.name}</p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  {new Date(e.eventDate).toLocaleDateString("fr-FR")} · {FORMAT_LABELS[e.format] ?? e.format}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
