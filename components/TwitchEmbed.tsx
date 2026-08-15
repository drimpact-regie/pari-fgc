"use client";

import { useEffect, useState } from "react";

/**
 * Le lecteur Twitch intégré exige un paramètre "parent" qui corresponde
 * exactement au nom d'hôte de la page qui l'affiche (sécurité anti-embed de
 * Twitch). L'app tournant sur plusieurs domaines (impactobet.fr,
 * *.vercel.app, localhost en dev), on le lit dynamiquement côté client
 * plutôt que de le coder en dur.
 */
export default function TwitchEmbed({ channel }: { channel: string }) {
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    // Ne peut être lu qu'après montage côté client (SSR n'a pas de
    // `window`) ; rendre `null` d'abord évite un mismatch d'hydratation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHostname(window.location.hostname);
  }, []);

  if (!hostname) return null;

  const src = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(hostname)}&muted=true`;

  return (
    <div className="card p-4 flex flex-col gap-2">
      <p className="text-sm font-semibold">
        En direct sur Twitch —{" "}
        <a
          href={`https://www.twitch.tv/${channel}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          style={{ color: "var(--accent)" }}
        >
          {channel}
        </a>
      </p>
      <div className="w-full overflow-hidden rounded-lg" style={{ aspectRatio: "16 / 9" }}>
        <iframe
          src={src}
          title={`Lecteur Twitch — ${channel}`}
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
