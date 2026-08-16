import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listTournaments } from "@/lib/tournaments";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="max-w-md mx-auto card p-6 flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold">Impact&apos;O Bet</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Paris entre potes sur les brackets FGC — via le site ou directement depuis le chat
            Twitch.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Link href="/register" className="btn btn-primary text-center">
            Parieur — je veux parier
          </Link>
          <Link href="/streamer" className="btn text-center">
            Streamer — j&apos;anime un tournoi
          </Link>
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Déjà inscrit ?{" "}
          <Link href="/login" className="underline">
            Se connecter
          </Link>
        </p>
      </div>
    );
  }

  const tournaments = await listTournaments();
  redirect(`/t/${tournaments[0].id}/matches`);
}
