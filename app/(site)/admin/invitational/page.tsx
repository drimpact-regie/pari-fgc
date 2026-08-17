import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listInvitationalEvents } from "@/lib/invitationalEvents";
import { listInvitationalEventRequests } from "@/lib/invitationalRequests";
import AddInvitationalEventForm from "@/components/AddInvitationalEventForm";
import InvitationalEventStatusEditor from "@/components/InvitationalEventStatusEditor";
import DeleteInvitationalEventButton from "@/components/DeleteInvitationalEventButton";

export const dynamic = "force-dynamic";

const FORMAT_LABELS: Record<string, string> = {
  BRACKET_SINGLE: "Bracket simple élimination",
  BRACKET_DOUBLE: "Bracket double élimination",
  ROUND_ROBIN: "Round robin",
  SWISS: "Suisse",
  POOLS: "Poules",
  LIST: "Liste de matchs",
};

export default async function AdminInvitationalPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const events = await listInvitationalEvents();
  const activeEvents = events.filter((e) => e.status === "ACTIVE");
  const pastEvents = events.filter((e) => e.status === "PAST");
  const pendingRequests = await listInvitationalEventRequests("PENDING");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Invitational / Prestataire</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Events sans présence start.gg (showmatches, exhibitions, weeklies invités) : import
          Excel/CSV puis gestion 100% manuelle depuis cette interface. Économie et classement
          séparés du reste du site.
        </p>
        <Link
          href="/admin/invitational/requests"
          className="text-sm underline mt-2 inline-block"
          style={{ color: "var(--accent)" }}
        >
          Demandes en attente ({pendingRequests.length})
        </Link>
      </div>

      <EventTable title="Events actifs" events={activeEvents} emptyLabel="Aucun event actif." />
      <EventTable title="Events passés" events={pastEvents} emptyLabel="Aucun event passé." />

      <AddInvitationalEventForm />
    </div>
  );
}

function EventTable({
  title,
  events,
  emptyLabel,
}: {
  title: string;
  events: Awaited<ReturnType<typeof listInvitationalEvents>>;
  emptyLabel: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-2 text-sm font-semibold" style={{ background: "var(--surface-alt)" }}>
        {title}
      </div>
      {events.length === 0 ? (
        <p className="p-4 text-sm" style={{ color: "var(--muted)" }}>
          {emptyLabel}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: "var(--muted)" }}>
              <th className="px-4 py-2 font-medium">Nom</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Format</th>
              <th className="px-4 py-2 font-medium">Statut</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-2 font-medium">
                  <Link href={`/admin/invitational/${e.id}`} className="underline" style={{ color: "var(--accent)" }}>
                    {e.name}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  {new Date(e.eventDate).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-2">{FORMAT_LABELS[e.format] ?? e.format}</td>
                <td className="px-4 py-2">
                  <InvitationalEventStatusEditor eventId={e.id} status={e.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  <DeleteInvitationalEventButton eventId={e.id} eventName={e.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
