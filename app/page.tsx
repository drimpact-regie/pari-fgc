import Link from "next/link";

import { auth } from "@/lib/auth";
import { getEventInfo, StartggApiError } from "@/lib/startgg";
import { STARTGG_EVENT_SLUG } from "@/config/tournament";

export default async function Home() {
  const session = await auth();

  let eventInfo = null;
  let error: string | null = null;
  try {
    eventInfo = await getEventInfo();
  } catch (err) {
    error = err instanceof StartggApiError ? err.message : "Erreur inconnue.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <p className="text-sm uppercase tracking-wide" style={{ color: "var(--accent)" }}>
          Event suivi
        </p>
        {error ? (
          <p className="mt-2" style={{ color: "var(--lose)" }}>
            Impossible de récupérer l&apos;event start.gg : {error}
          </p>
        ) : eventInfo ? (
          <>
            <h1 className="text-2xl font-bold mt-1">
              {eventInfo.tournamentName} — {eventInfo.name}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {eventInfo.numEntrants ?? "?"} participants · slug configuré :{" "}
              <code className="font-mono">{STARTGG_EVENT_SLUG}</code>
            </p>
          </>
        ) : (
          <p className="mt-2" style={{ color: "var(--muted)" }}>
            Event introuvable pour le slug configuré.
          </p>
        )}
      </div>

      {session?.user ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/matches" className="card p-5 hover:opacity-90">
            <h2 className="font-semibold">Parier</h2>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              Matchs à venir sur le bracket
            </p>
          </Link>
          <Link href="/players" className="card p-5 hover:opacity-90">
            <h2 className="font-semibold">Joueurs</h2>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              Classement et stats de l&apos;event
            </p>
          </Link>
          <Link href="/leaderboard" className="card p-5 hover:opacity-90">
            <h2 className="font-semibold">Classement</h2>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              Qui a les meilleurs pronostics
            </p>
          </Link>
        </div>
      ) : (
        <div className="card p-6">
          <p>
            Connecte-toi ou inscris-toi pour parier sur les matchs du bracket.
          </p>
        </div>
      )}
    </div>
  );
}
