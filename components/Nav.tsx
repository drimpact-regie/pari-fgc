import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/LogoutButton";
import AdminMenu from "@/components/AdminMenu";

export default async function Nav() {
  const session = await auth();
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
          🎮 Impact&apos;O Bet
        </Link>

        {session?.user ? (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/leaderboard" className="hover:opacity-80">
              LeaderBet
            </Link>
            {session.user.isAdmin && <AdminMenu />}
            {ownedInvitationalCount > 0 && (
              <Link href="/partner/invitational" className="hover:opacity-80">
                Mes events
              </Link>
            )}
            {currentUser && (
              <span className="font-semibold" style={{ color: "var(--gold)" }}>
                {currentUser.exBalance} Ex
              </span>
            )}
            <Link href="/account" className="hover:opacity-80" style={{ color: "var(--muted)" }}>
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
