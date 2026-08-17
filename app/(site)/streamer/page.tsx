import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Point d'entrée "Streamer" depuis la page d'accueil : flux self-service
 * public — n'importe quel streamer peut autoriser le bot sur SA chaîne
 * (scope channel:bot) sans compte sur ce site, sans statut de
 * modérateur/Editor préalable, et sans dépendre d'un lien avec le compte
 * admin. Voir /api/streamer/authorize/connect.
 */
export default async function StreamerPage({
  searchParams,
}: {
  searchParams: Promise<{ authorized?: string; authError?: string }>;
}) {
  const { authorized, authError } = await searchParams;
  const botToken = await prisma.twitchBotToken.findUnique({ where: { id: "singleton" } });

  return (
    <div className="max-w-lg mx-auto card p-6 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Installer le bot sur ta chaîne</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Pour activer les paris directement dans ton chat Twitch (!bet, Le Pari du Parry...).
        </p>
      </div>

      {authorized && (
        <div className="text-sm" style={{ color: "var(--win)" }}>
          Bot autorisé sur la chaîne <strong>{authorized}</strong> ! Dernière étape : contacte un
          admin pour relier ta chaîne au tournoi que tu animes.
        </div>
      )}
      {authError && (
        <div className="text-sm" style={{ color: "var(--lose)" }}>
          {decodeURIComponent(authError)}
        </div>
      )}

      <a href="/api/streamer/authorize/connect" className="btn btn-primary text-center">
        Autoriser le bot sur ma chaîne
      </a>
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Tu seras redirigé vers Twitch pour confirmer avec ton propre compte — aucune inscription
        sur ce site n&apos;est nécessaire, et le bot n&apos;a besoin d&apos;aucun statut particulier
        (modérateur, Editor...) chez toi au préalable.
      </p>

      <div className="flex items-center gap-3">
        <div className="flex-1 border-t" style={{ borderColor: "var(--border)" }} />
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          alternative
        </span>
        <div className="flex-1 border-t" style={{ borderColor: "var(--border)" }} />
      </div>

      <div className="text-sm flex flex-col gap-2">
        <p style={{ color: "var(--muted)" }}>
          Tu peux aussi ajouter le bot comme modérateur classique de ta chaîne, depuis ton chat
          Twitch :
        </p>
        <div
          className="px-3 py-2 rounded-md font-mono text-xs"
          style={{ background: "var(--surface-alt)" }}
        >
          /mod {botToken ? botToken.login : "<compte du bot — demande-le à un admin>"}
        </div>
      </div>

      <p className="text-sm">
        Dans les deux cas, contacte ensuite un admin d&apos;Impact&apos;O Bet pour relier ta
        chaîne au tournoi que tu animes — c&apos;est cette dernière étape qui active les commandes
        de pari dans ton chat.
      </p>

      {!botToken && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Le bot n&apos;est pas encore connecté côté site — un admin doit d&apos;abord le
          configurer.
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
