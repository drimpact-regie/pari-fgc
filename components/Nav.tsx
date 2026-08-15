import Link from "next/link";

import { auth } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import AdminMenu from "@/components/AdminMenu";

export default async function Nav() {
  const session = await auth();

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
