import Link from "next/link";

import type { TournamentCardInfo } from "@/lib/tournaments";

export default function TournamentBannerCard({
  tournament,
  href,
}: {
  tournament: TournamentCardInfo;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="card relative flex items-end overflow-hidden hover:opacity-90"
      style={{
        height: "8rem",
        backgroundImage: tournament.bannerUrl
          ? `linear-gradient(rgba(11,13,18,0.15), rgba(11,13,18,0.9)), url(${tournament.bannerUrl})`
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {tournament.videogameImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tournament.videogameImageUrl}
          alt=""
          className="absolute top-3 right-3 rounded-md object-cover"
          style={{ width: "3rem", height: "3rem", boxShadow: "0 0 0 2px rgba(255,255,255,0.2)" }}
        />
      )}
      <span className="font-semibold text-lg p-4 drop-shadow">{tournament.name}</span>
    </Link>
  );
}
