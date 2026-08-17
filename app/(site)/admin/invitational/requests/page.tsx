import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { INVITATIONAL_FORMAT_LABELS } from "@/lib/invitationalFormats";
import { listInvitationalEventRequests } from "@/lib/invitationalRequests";
import InvitationalRequestActions from "@/components/InvitationalRequestActions";

export const dynamic = "force-dynamic";

const IDENT_LABELS: Record<string, string> = {
  TWITCH: "Connexion Twitch",
  MANUAL: "Formulaire manuel",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  REJECTED: "Refusée",
};

export default async function InvitationalRequestsPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const requests = await listInvitationalEventRequests();
  const pending = requests.filter((r) => r.status === "PENDING");
  const reviewed = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/admin/invitational" className="text-xs underline" style={{ color: "var(--accent)" }}>
          ← Events Invitational/Prestataire
        </Link>
        <h1 className="text-xl font-semibold mt-1">Demandes d&apos;event Invitational/Prestataire</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Confirmer une demande crée l&apos;event et accorde l&apos;accès self-service au
          prestataire (voir /invitational/request).
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-2 text-sm font-semibold" style={{ background: "var(--surface-alt)" }}>
          En attente ({pending.length})
        </div>
        {pending.length === 0 ? (
          <p className="p-4 text-sm" style={{ color: "var(--muted)" }}>
            Aucune demande en attente.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-4 py-2 font-medium">Event</th>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Chaîne Twitch</th>
                <th className="px-4 py-2 font-medium">Deadline</th>
                <th className="px-4 py-2 font-medium">Format</th>
                <th className="px-4 py-2 font-medium">Identification</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2 font-medium">{r.eventName}</td>
                  <td className="px-4 py-2">
                    {r.clientName ?? r.requesterUser?.username ?? "—"}
                    {r.email && (
                      <>
                        <br />
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          {r.email}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-2">{r.twitchChannel}</td>
                  <td className="px-4 py-2">{new Date(r.deadline).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2">{INVITATIONAL_FORMAT_LABELS[r.format] ?? r.format}</td>
                  <td className="px-4 py-2">{IDENT_LABELS[r.identMethod] ?? r.identMethod}</td>
                  <td className="px-4 py-2">
                    <InvitationalRequestActions requestId={r.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reviewed.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 text-sm font-semibold" style={{ background: "var(--surface-alt)" }}>
            Traitées
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-4 py-2 font-medium">Event</th>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Statut</th>
                <th className="px-4 py-2 font-medium">Motif</th>
              </tr>
            </thead>
            <tbody>
              {reviewed.map((r) => (
                <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2 font-medium">{r.eventName}</td>
                  <td className="px-4 py-2">{r.clientName ?? r.requesterUser?.username ?? "—"}</td>
                  <td className="px-4 py-2">{STATUS_LABELS[r.status] ?? r.status}</td>
                  <td className="px-4 py-2 text-xs" style={{ color: "var(--muted)" }}>
                    {r.rejectionNote ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
