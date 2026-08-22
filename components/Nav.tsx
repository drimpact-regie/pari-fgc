import Link from "next/link";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bridgeHref, domainOfHost } from "@/lib/domainRouting";
import LogoutButton from "@/components/LogoutButton";
import AdminMenu from "@/components/AdminMenu";

export default async function Nav() {
  const session = await auth();
  const host = (await headers()).get("host") ?? "";
  // Même app, mais l'identité affichée change selon le domaine : "Bet" pour
  // le parieur (impactobet.fr), "Bot" pour le streamer/régie (impactobot.fr).
  const isStreamerDomain = domainOfHost(host) === "streamer";
  const brandName = isStreamerDomain ? "Impact'O Bot" : "Impact'O Bet";
  const currentUser = session?.user
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { exBalance: true } })
    : null;
  // N'affiche "Mes events" que pour les comptes qui en possèdent au moins un
  // (portail self-service prestataire) — évite d'encombrer la nav des ~30
  // parieurs classiques qui n'ont jamais fait de demande.
  const ownedInvitationalCount = session?.user?.id
    ? await prisma.invitationalEvent.count({ where: { ownerUserId: session.user.id } })
    : 0;

  return (
    <header
      className="border-b"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="font-semibold tracking-tight">
          🎮 {brandName}
        </Link>

        {session?.user ? (
          <nav className="flex items-center gap-4 text-sm">
            {isStreamerDomain ? (
              session.user.isAdmin && (
                <>
                  <Link href="/admin/streamers" className="hover:opacity-80">
                    Les streameurs
                  </Link>
                  <Link href="/admin/tournaments" className="hover:opacity-80">
                    Tournois
                  </Link>
                  <Link href="/admin/invitational" className="hover:opacity-80">
                    Invitational / Prestataire
                  </Link>
                  <Link href="/admin" className="hover:opacity-80" style={{ color: "var(--accent)" }}>
                    Admin
                  </Link>
                </>
              )
            ) : (
              <>
                <Link href={bridgeHref("/leaderboard", host)} className="hover:opacity-80">
                  LeaderBet
                </Link>
                <Link href={bridgeHref("/beaters", host)} className="hover:opacity-80">
                  Les Beaters
                </Link>
                {session.user.isAdmin && <AdminMenu host={host} />}
              </>
            )}
            {ownedInvitationalCount > 0 && (
              <Link href={bridgeHref("/partner/invitational", host)} className="hover:opacity-80">
                Mes events
              </Link>
            )}
            {currentUser && (
              <span className="font-semibold" style={{ color: "var(--gold)" }}>
                {currentUser.exBalance} Ex
              </span>
            )}
            <Link href={bridgeHref("/account", host)} className="hover:opacity-80" style={{ color: "var(--muted)" }}>
              {session.user.name}
            </Link>
            <LogoutButton />
          </nav>
        ) : (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="hover:opacity-80">
              Connexion
            </Link>
            <Link href="/register" className="hover:opacity-80">
              Inscription
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
