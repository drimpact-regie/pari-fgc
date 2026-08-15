/**
 * Fonctions pures (aucun accès réseau/DB) pour le parsing et le matching
 * des sous-commandes "Le Pari du Parry" du chat Twitch (!bet mvc, !bet
 * reset) — séparées du handler webhook pour rester facilement testables.
 */

/**
 * Casse, accents et ponctuation normalises pour un matching tolerant : les
 * espaces, tirets, apostrophes et points sont retires entierement (pas
 * seulement collapses), pour que "spiderman", "spider man" et "Spider-Man"
 * soient tous equivalents - le chat tape rarement la ponctuation exacte
 * d'un nom compose.
 */
export function normalizeForMatch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export interface CharacterMatchCandidate {
  id: string;
  name: string;
}

export interface CharacterMatchResult {
  match: CharacterMatchCandidate | null;
  /** Noms proches à suggérer quand `match` est null (peut être vide). */
  suggestions: string[];
}

/**
 * Fait correspondre un nom tapé en chat (souvent imparfait) à un personnage
 * du roster. Exact > préfixe > sous-chaîne, chacun uniquement si la
 * correspondance est unique ; sinon on ne devine pas et on suggère les noms
 * les plus proches (distance de Levenshtein) plutôt que de rejeter sans
 * explication.
 */
export function matchCharacterName(
  input: string,
  characters: CharacterMatchCandidate[],
): CharacterMatchResult {
  const query = normalizeForMatch(input);
  if (!query) return { match: null, suggestions: [] };

  const withNorm = characters.map((c) => ({ c, norm: normalizeForMatch(c.name) }));

  const exact = withNorm.find((x) => x.norm === query);
  if (exact) return { match: exact.c, suggestions: [] };

  const prefixMatches = withNorm.filter(
    (x) => x.norm.startsWith(query) || query.startsWith(x.norm),
  );
  if (prefixMatches.length === 1) return { match: prefixMatches[0].c, suggestions: [] };
  // Plusieurs préfixes correspondent (ex. "mag" -> Magik/Magneto) : les
  // deux sont des candidats légitimes, pas la peine de les départager par
  // distance d'édition, qui pourrait à tort en exclure un des deux.
  if (prefixMatches.length > 1) {
    return { match: null, suggestions: prefixMatches.slice(0, 5).map((x) => x.c.name) };
  }

  const containsMatches = withNorm.filter((x) => x.norm.includes(query));
  if (containsMatches.length === 1) return { match: containsMatches[0].c, suggestions: [] };
  if (containsMatches.length > 1) {
    return { match: null, suggestions: containsMatches.slice(0, 5).map((x) => x.c.name) };
  }

  // Aucune correspondance préfixe/sous-chaîne : tolérance aux fautes de
  // frappe via distance d'édition sur tout le roster.
  const maxDistance = Math.max(3, Math.ceil(query.length / 2));
  const suggestions = withNorm
    .map((x) => ({ name: x.c.name, distance: levenshtein(query, x.norm) }))
    .filter((s) => s.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)
    .map((s) => s.name);

  return { match: null, suggestions };
}

// --- Commande MVC : "mvc <personnage> <0-8>" --------------------------------

export function isMvcCommand(target: string): boolean {
  return /^mvc\b/i.test(target.trim());
}

export interface ParsedMvcCommand {
  characterQuery: string;
  count: number;
}

/** Renvoie null si la commande commence bien par "mvc" mais est mal formée. */
export function parseMvcCommand(target: string): ParsedMvcCommand | null {
  const match = /^mvc\s+(.+?)\s+(\d+)\s*$/i.exec(target.trim());
  if (!match) return null;

  const characterQuery = match[1].trim();
  const count = Number(match[2]);
  if (!characterQuery || !Number.isInteger(count) || count < 0 || count > 8) return null;

  return { characterQuery, count };
}

// --- Commande reset de bracket : "reset oui|non|yes|no" ---------------------

export function isResetCommand(target: string): boolean {
  return /^reset\b/i.test(target.trim());
}

const RESET_YES_WORDS = new Set(["oui", "yes", "y", "o"]);
const RESET_NO_WORDS = new Set(["non", "no", "n"]);

/** Renvoie null si la commande commence bien par "reset" mais est mal formée. */
export function parseResetCommand(target: string): boolean | null {
  const match = /^reset\s+(\S+)\s*$/i.exec(target.trim());
  if (!match) return null;

  const word = match[1].toLowerCase();
  if (RESET_YES_WORDS.has(word)) return true;
  if (RESET_NO_WORDS.has(word)) return false;
  return null;
}

// --- Commande top 8 : "top8 <j1>, <j2>, ..." (alias de !top8 sous !bet) -----

export function isTop8Command(target: string): boolean {
  return /^top ?8\b/i.test(target.trim());
}

/** Renvoie null si la cible ne commence pas par "top8"/"top 8". */
export function parseTop8Target(target: string): string | null {
  const match = /^top ?8\s*(.*)$/i.exec(target.trim());
  return match ? match[1].trim() : null;
}

// --- Commande aide : "!bet", "!bet aide", "!bet help" -----------------------

export function isHelpCommand(target: string): boolean {
  const normalized = target.trim().toLowerCase();
  return normalized === "" || normalized === "aide" || normalized === "help";
}
