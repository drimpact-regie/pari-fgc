import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExAdjustmentForm from "@/components/ExAdjustmentForm";
import MigrateExBalancesButton from "@/components/MigrateExBalancesButton";

export const dynamic = "force-dynamic";

export default async function AdminExPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const [users, adjustments] = await Promise.all([
    prisma.user.findMany({ orderBy: { username: "asc" } }),
    prisma.exAdjustment.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { username: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Gérer les soldes Ex</h1>

      <MigrateExBalancesButton />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface-alt)", color: "var(--muted)" }}>
              <th className="px-4 py-2 font-medium">Utilisateur</th>
              <th className="px-4 py-2 font-medium">Solde</th>
              <th className="px-4 py-2 font-medium">Ajustement manuel</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-2 font-medium">{u.username}</td>
                <td className="px-4 py-2 font-semibold" style={{ color: "var(--gold)" }}>
                  {u.exBalance} Ex
                </td>
                <td className="px-4 py-2">
                  <ExAdjustmentForm userId={u.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-2">Historique des ajustements manuels</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface-alt)", color: "var(--muted)" }}>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Utilisateur</th>
                <th className="px-4 py-2 font-medium">Montant</th>
                <th className="px-4 py-2 font-medium">Raison</th>
                <th className="px-4 py-2 font-medium">Par</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((a) => (
                <tr key={a.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2 text-xs" style={{ color: "var(--muted)" }}>
                    {a.createdAt.toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-2">{a.user.username}</td>
                  <td
                    className="px-4 py-2 font-semibold"
                    style={{ color: a.amount >= 0 ? "var(--win)" : "var(--lose)" }}
                  >
                    {a.amount >= 0 ? "+" : ""}
                    {a.amount} Ex
                  </td>
                  <td className="px-4 py-2">{a.reason}</td>
                  <td className="px-4 py-2 text-xs" style={{ color: "var(--muted)" }}>
                    {a.adminUsername}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {adjustments.length === 0 && (
            <p className="p-4 text-sm" style={{ color: "var(--muted)" }}>
              Aucun ajustement manuel pour l&apos;instant.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
