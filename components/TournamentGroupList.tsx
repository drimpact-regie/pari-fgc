import type { TournamentGroupInfo } from "@/lib/tournaments";
import TournamentBannerCard from "@/components/TournamentBannerCard";

/**
 * Rendu partagé d'une liste de tournois déjà regroupée par événement (voir
 * groupTournamentsForDisplay dans lib/tournaments.ts) — utilisé aussi bien
 * par l'accueil parieur que par /admin/tournaments, chacun fournissant son
 * propre lien de destination par tournoi (page de matchs côté parieur, page
 * de régie côté admin).
 */
export default function TournamentGroupList({
  groups,
  hrefForTournament,
}: {
  groups: TournamentGroupInfo[];
  hrefForTournament: (tournamentId: string) => string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) =>
        group.cards.length === 1 ? (
          <TournamentBannerCard
            key={group.rootSlug}
            tournament={group.cards[0]}
            href={hrefForTournament(group.cards[0].id)}
          />
        ) : (
          <details key={group.rootSlug} className="card overflow-hidden" open>
            <summary
              className="px-4 py-3 cursor-pointer font-semibold text-lg flex items-center justify-between gap-3"
              style={{
                backgroundImage: group.bannerUrl
                  ? `linear-gradient(rgba(11,13,18,0.55), rgba(11,13,18,0.85)), url(${group.bannerUrl})`
                  : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <span className="drop-shadow">{group.label}</span>
              <span className="text-xs font-normal whitespace-nowrap" style={{ color: "var(--muted)" }}>
                {group.cards.length} jeux
              </span>
            </summary>
            <div className="flex flex-col gap-3 p-3">
              {group.cards.map((card) => (
                <TournamentBannerCard key={card.id} tournament={card} href={hrefForTournament(card.id)} />
              ))}
            </div>
          </details>
        ),
      )}
    </div>
  );
}
