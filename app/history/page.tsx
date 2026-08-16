import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  PENDING: "En attente",
  WON: "Gagné",
  LOST: "Perdu",
  CANCELLED: "Annulé",
} as const;
const STATUS_COLOR = {
  PENDING: "var(--muted)",
  WON: "var(--win)",
  LOST: "var(--lose)",
  CANCELLED: "var(--warn)",
} as const;

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?from=%2Fhistory");
  }

  const [bets, invitationalBets] = await Promise.all([
    prisma.bet.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invitationalBet.findMany({
      where: { userId: session.user.id },
      include: { event: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Historique de mes paris</h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Paris classiques sur matchs (mise + cote). Le Pari du Parry (MVC, reset, Top 8) reste
        consultable sur la page de chaque tournoi.
      </p>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface-alt)", color: "var(--muted)" }}>
              <th className="px-4 py-2 font-medium">Match</th>
              <th className="px-4 py-2 font-medium">Mise</th>
              <th className="px-4 py-2 font-medium">Cote</th>
              <th className="px-4 py-2 font-medium">Statut</th>
              <th className="px-4 py-2 font-medium">Gain / Perte</th>
              <th className="px-4 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((bet) => {
              const hasStakeData = bet.stake != null && bet.odds != null;
              const netResult =
                bet.status === "WON"
                  ? bet.pointsAwarded - (bet.stake ?? 0)
                  : bet.status === "LOST"
                    ? -(bet.stake ?? 0)
                    : null;
              const potential = hasStakeData ? Math.round(bet.stake! * bet.odds!) - bet.stake! : null;

              return (
                <tr key={bet.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2">
                    <span className="font-medium">{bet.roundText || "—"}</span>
                    <span className="block text-xs" style={{ color: "var(--muted)" }}>
                      Pari sur {bet.predictedEntrantName}
                    </span>
                  </td>
                  <td className="px-4 py-2">{hasStakeData ? `${bet.stake} Ex` : "—"}</td>
                  <td className="px-4 py-2">{hasStakeData ? bet.odds!.toFixed(2) : "—"}</td>
                  <td className="px-4 py-2" style={{ color: STATUS_COLOR[bet.status] }}>
                    {STATUS_LABEL[bet.status]}
                  </td>
                  <td
                    className="px-4 py-2 font-semibold"
                    style={{
                      color:
                        netResult != null
                          ? netResult >= 0
                            ? "var(--win)"
                            : "var(--lose)"
                          : "var(--muted)",
                    }}
                  >
                    {netResult != null
                      ? `${netResult >= 0 ? "+" : ""}${netResult} Ex`
                      : potential != null
                        ? `potentiel +${potential} Ex`
                        : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs" style={{ color: "var(--muted)" }}>
                    {bet.createdAt.toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {bets.length === 0 && (
          <p className="p-4 text-sm" style={{ color: "var(--muted)" }}>
            Aucun pari pour l&apos;instant.
          </p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold">Paris Invitational / Prestataire</h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Économie séparée (solde et gains distincts des paris classiques ci-dessus).
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface-alt)", color: "var(--muted)" }}>
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="px-4 py-2 font-medium">Mise</th>
              <th className="px-4 py-2 font-medium">Cote</th>
              <th className="px-4 py-2 font-medium">Statut</th>
              <th className="px-4 py-2 font-medium">Gain / Perte</th>
              <th className="px-4 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {invitationalBets.map((bet) => {
              const netResult =
                bet.status === "WON"
                  ? bet.pointsAwarded - bet.stake
                  : bet.status === "LOST"
                    ? -bet.stake
                    : null;
              const potential = bet.status === "PENDING" ? Math.round(bet.stake * bet.odds) - bet.stake : null;

              return (
                <tr key={bet.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2">
                    <span className="font-medium">{bet.event.name}</span>
                    <span className="block text-xs" style={{ color: "var(--muted)" }}>
                      Pari sur {bet.predictedCompetitorName}
                    </span>
                  </td>
                  <td className="px-4 py-2">{bet.stake} Ex</td>
                  <td className="px-4 py-2">{bet.odds.toFixed(2)}</td>
                  <td className="px-4 py-2" style={{ color: STATUS_COLOR[bet.status] }}>
                    {STATUS_LABEL[bet.status]}
                  </td>
                  <td
                    className="px-4 py-2 font-semibold"
                    style={{
                      color:
                        netResult != null ? (netResult >= 0 ? "var(--win)" : "var(--lose)") : "var(--muted)",
                    }}
                  >
                    {netResult != null
                      ? `${netResult >= 0 ? "+" : ""}${netResult} Ex`
                      : potential != null
                        ? `potentiel +${potential} Ex`
                        : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs" style={{ color: "var(--muted)" }}>
                    {bet.createdAt.toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {invitationalBets.length === 0 && (
          <p className="p-4 text-sm" style={{ color: "var(--muted)" }}>
            Aucun pari Invitational / Prestataire pour l&apos;instant.
          </p>
        )}
      </div>
    </div>
  );
}
