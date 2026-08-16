import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Point d'entrée "Streamer" depuis la page d'accueil. Il n'existe pas
 * aujourd'hui de flux d'autorisation OAuth self-service (scope
 * `channel:bot`) pour qu'un streamer connecte le bot lui-même — le seul
 * mécanisme en place est : le bot doit être ajouté modérateur sur la
 * chaîne (commande Twitch classique), puis un admin relie cette chaîne à
 * un tournoi depuis /admin/tournaments. Cette page documente donc ce
 * mécanisme existant plutôt que d'en inventer un nouveau.
 */
export default async function StreamerPage() {
  const botToken = await prisma.twitchBotToken.findUnique({ where: { id: "singleton" } });

  return (
    <div className="max-w-lg mx-auto card p-6 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Installer le bot sur ta chaîne</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Pour activer les paris directement dans ton chat Twitch (!bet, Le Pari du Parry...) :
        </p>
      </div>

      <ol className="flex flex-col gap-3 text-sm list-decimal list-inside">
        <li>
          Ajoute le bot comme modérateur de ta chaîne, depuis ton chat Twitch :
          <div
            className="mt-1 px-3 py-2 rounded-md font-mono text-xs"
            style={{ background: "var(--surface-alt)" }}
          >
            /mod {botToken ? botToken.login : "<compte du bot — demande-le à un admin>"}
          </div>
        </li>
        <li>
          Contacte un admin d&apos;Impact&apos;O Bet pour relier ta chaîne au tournoi que tu
          animes — c&apos;est cette étape qui active les commandes de pari dans ton chat.
        </li>
      </ol>

      {!botToken && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Le bot n&apos;est pas encore connecté côté site — un admin doit d&apos;abord le
          configurer avant que l&apos;étape 1 soit possible.
        </p>
      )}

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Tu veux aussi parier toi-même ?{" "}
        <Link href="/register" className="underline">
          Inscris-toi
        </Link>
        .
      </p>
    </div>
  );
}
