"use client";

/**
 * Filtre les matchs déjà rendus par joueur/équipe, sans requête
 * supplémentaire ni état React à faire redescendre dans tout l'arbre
 * (page.tsx reste un Server Component classique) : chaque niveau
 * (étape, round, match — voir searchableNames/data-entrant-names dans
 * page.tsx) porte déjà l'ensemble des noms qu'il contient, donc un
 * <details> parent redevient visible dès qu'UN de ses matchs correspond,
 * sans avoir à recalculer quoi que ce soit côté client.
 */
export default function MatchesSearchBar() {
  function handleChange(value: string) {
    const query = value.trim().toLowerCase();
    const nodes = document.querySelectorAll<HTMLElement>("[data-entrant-names]");

    nodes.forEach((el) => {
      const names = el.dataset.entrantNames ?? "";
      const isMatch = query === "" || names.includes(query);
      el.hidden = !isMatch;

      if (isMatch && query !== "" && el instanceof HTMLDetailsElement) {
        el.open = true;
      }
    });
  }

  return (
    <input
      type="search"
      className="input text-sm"
      placeholder="Rechercher un joueur ou une équipe..."
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Rechercher un joueur ou une équipe"
    />
  );
}
