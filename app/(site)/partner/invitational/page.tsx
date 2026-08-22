import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { listInvitationalEventsForOwner } from "@/lib/invitationalEvents";
import { INVITATIONAL_FORMAT_LABELS } from "@/lib/invitationalFormats";
import { bridgeHref } from "@/lib/domainRouting";

export const dynamic = "force-dynamic";

/**
 * Liste des events dont le compte connecté est le prestataire propriétaire
 * (portail self-service, identification Twitch — voir
 * lib/invitationalAccess.ts). Nécessite une vraie session : le parcours
 * "identification manuelle par email" n'a pas d'équivalent ici, chaque lien
 * d'accès mène directement à un event précis (voir .../[eventId]).
 */
export default async function PartnerInvitationalListPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?from=/partner/invitational");
  }
  const host = (await headers()).get("host") ?? "";

  const events = await listInvitationalEventsForOwner(session.user.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Mes events</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Events Invitational/Prestataire confirmés dont vous êtes le prestataire.
        </p>
      </div>

      {events.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Aucun event confirmé pour l&apos;instant.{" "}
          <Link href={bridgeHref("/invitational/request", host)} className="underline" style={{ color: "var(--accent)" }}>
            Faire une demande
          </Link>
          .
        </p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-4 py-2 font-medium">Nom</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Format</th>
                <th className="px-4 py-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/partner/invitational/${e.id}`} className="underline" style={{ color: "var(--accent)" }}>
                      {e.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{new Date(e.eventDate).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2">{INVITATIONAL_FORMAT_LABELS[e.format] ?? e.format}</td>
                  <td className="px-4 py-2">{e.status === "ACTIVE" ? "Actif" : "Passé"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
