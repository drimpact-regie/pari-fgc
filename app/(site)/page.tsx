import Link from "next/link";

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

  // Liste plutôt qu'un redirect direct vers un tournoi précis : un tournoi
  // peut être supprimé/archivé après qu'un visiteur a mis "/" en favori ou
  // avec une page mise en cache côté navigateur, ce qui transformait ce
  // redirect en 404 pointant vers un tournoi qui n'existe plus.
  const tournaments = await listTournaments();
  const sorted = [...tournaments].reverse(); // plus récent d'abord

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Tournois</h1>
      <div className="flex flex-col gap-3">
        {sorted.map((t) => (
          <Link key={t.id} href={`/t/${t.id}/matches`} className="card p-4 hover:opacity-90">
            <span className="font-semibold">{t.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
