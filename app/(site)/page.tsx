import Link from "next/link";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listTournaments } from "@/lib/tournaments";
import { getEventInfo } from "@/lib/startgg";
import { crossDomainHref, domainOfHost } from "@/lib/domainRouting";
import { isAuthorizedStreamer } from "@/lib/streamerAuthorization";

/**
 * "/" est servie IDENTIQUEMENT quel que soit le domaine côté routage
 * (jamais de redirection — voir classifyPath), mais son RENDU diffère
 * volontairement une fois connecté : liste des tournois sur
 * impactobet.fr (parieur), accueil régie sur impactobot.fr (streamer /
 * prestataire), reprenant l'entrée "Streamer" de l'ancien accueil unique.
 * En dev/preview (un seul hostname), domainOfHost() renvoie `null` et
 * l'accueil parieur reste l'affichage par défaut.
 */
export default async function Home() {
  const session = await auth();
  const host = (await headers()).get("host") ?? "";

  if (!session?.user) {
    // impactobot.fr est une interface streamer/régie uniquement — pas de
    // choix "Parieur" avant connexion sur ce domaine (voir domainOfHost).
    // En dev/preview (un seul hostname), domainOfHost() renvoie `null` et
    // l'accueil garde les deux entrées, comme aujourd'hui.
    const isStreamerDomain = domainOfHost(host) === "streamer";
    return (
      <div className="max-w-md mx-auto card p-6 flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold">{isStreamerDomain ? "Impact'O Bot" : "Impact'O Bet"}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {isStreamerDomain
              ? "Régie de tournois FGC : bot Twitch, paris depuis le chat, overlays de stream."
              : "Paris entre potes sur les brackets FGC — via le site ou directement depuis le chat Twitch."}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {!isStreamerDomain && (
            <Link href="/register" className="btn btn-primary text-center">
              Parieur — je veux parier
            </Link>
          )}
          <Link href="/streamer" className={isStreamerDomain ? "btn btn-primary text-center" : "btn text-center"}>
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

  if (domainOfHost(host) === "streamer") {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twitchId: true },
    });
    const authorized = await isAuthorizedStreamer({
      isAdmin: session.user.isAdmin,
      twitchId: dbUser?.twitchId ?? null,
    });

    if (!authorized) {
      return (
        <div className="max-w-md mx-auto card p-6 flex flex-col gap-4">
          <div>
            <h1 className="text-xl font-semibold">Accès réservé</h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              L&apos;espace streamer/régie est réservé aux chaînes Twitch autorisées par
              l&apos;équipe Impact&apos;O Bet. Connecte-toi avec le compte Twitch de ta chaîne, ou
              demande à un admin de t&apos;ajouter à la liste des streamers autorisés.
            </p>
          </div>
          <Link href="/streamer" className="btn text-center">
            Installer le bot sur ma chaîne
          </Link>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            <Link href={crossDomainHref("/", "parieur", host)} className="underline">
              Voir le site parieur
            </Link>
          </p>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto card p-6 flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold">Espace streamer &amp; régie</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Autorisation du bot Twitch, gestion Invitational/Prestataire et outils
            d&apos;administration des tournois.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Link href="/streamer" className="btn text-center">
            Installer le bot sur ma chaîne
          </Link>
          <Link href="/partner/invitational" className="btn text-center">
            Mes events Invitational
          </Link>
          {session.user.isAdmin && (
            <Link href="/admin/tournaments" className="btn btn-primary text-center">
              Administration
            </Link>
          )}
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          <Link href={crossDomainHref("/", "parieur", host)} className="underline">
            Voir le site parieur
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

  // Bannière start.gg de chaque tournoi, en pur bonus visuel : un échec
  // (event introuvable, start.gg indisponible) ne doit jamais empêcher la
  // liste de s'afficher, comme pour la bannière déjà utilisée sur les pages
  // d'un tournoi (voir t/[tournamentId]/layout.tsx).
  const bannerUrls = await Promise.all(
    sorted.map((t) =>
      getEventInfo(t.eventSlug)
        .then((info) => info?.bannerUrl ?? null)
        .catch(() => null),
    ),
  );

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Tournois</h1>
      <div className="flex flex-col gap-3">
        {sorted.map((t, i) => {
          const bannerUrl = bannerUrls[i];
          return (
            <Link
              key={t.id}
              href={`/t/${t.id}/matches`}
              className="card relative flex items-end overflow-hidden hover:opacity-90"
              style={{
                height: "8rem",
                backgroundImage: bannerUrl
                  ? `linear-gradient(rgba(11,13,18,0.15), rgba(11,13,18,0.9)), url(${bannerUrl})`
                  : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <span className="font-semibold text-lg p-4 drop-shadow">{t.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
