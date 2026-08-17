import * as XLSX from "xlsx";

import type { InvitationalFormat } from "@prisma/client";

export class InvitationalImportError extends Error {}

export interface ParsedCompetitor {
  name: string;
  tag: string | null;
  countryCode: string | null;
}

export interface ParsedMatch {
  groupLabel: string | null;
  orderIndex: number;
  competitorA: ParsedCompetitor | null;
  /** Description du compétiteur A pas encore déterminé (cellule "TBD_..."), voir parseCompetitorField. */
  placeholderA: string | null;
  competitorB: ParsedCompetitor | null;
  placeholderB: string | null;
}

export interface ParsedInvitationalImport {
  format: InvitationalFormat;
  matches: ParsedMatch[];
}

const KNOWN_FORMATS: InvitationalFormat[] = [
  "BRACKET_SINGLE",
  "BRACKET_DOUBLE",
  "ROUND_ROBIN",
  "SWISS",
  "POOLS",
  "LIST",
];

const INFO_SHEET_NAME = "info";
const MATCHES_SHEET_NAME = "matchs";
// Un onglet "Rundown" peut être présent dans le fichier (destiné au
// showrunner/régie) — jamais lu ni référencé ici : on ne recherche que les
// onglets "Info" et "Matchs" ci-dessus, tout le reste est ignoré tel quel.

/** Sans accents, sans casse, sans espaces superflus — pour matcher les en-têtes/valeurs sans configuration. */
function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // marques diacritiques combinantes (accents) apres decomposition NFD
    .trim()
    .toLowerCase();
}

function isBlankRow(row: unknown[]): boolean {
  return row.length === 0 || row.every((cell) => normalize(cell) === "");
}

function parseFormatValue(raw: unknown): InvitationalFormat {
  const value = normalize(raw).replace(/[\s-]+/g, "_").toUpperCase();
  const match = KNOWN_FORMATS.find((f) => f === value);
  if (!match) {
    throw new InvitationalImportError(
      `Format inconnu "${String(raw)}". Valeurs acceptées : ${KNOWN_FORMATS.join(", ")}.`,
    );
  }
  return match;
}

/**
 * En-têtes attendus de l'onglet "Matchs", dans n'importe quel ordre —
 * matching tolérant (sans accent/casse/espaces, voir normalize) plutôt
 * qu'une correspondance exacte, pour ne pas faire échouer l'import sur un
 * fichier légèrement différent (espace en trop, accent oublié...).
 */
const MATCH_COLUMNS = {
  groupe: ["groupe", "round", "phase"],
  ordre: ["ordre", "order"],
  nomA: ["joueur a", "joueura", "nom a"],
  tagA: ["tag a", "taga", "equipe a", "sponsor a"],
  paysA: ["pays a", "paysa", "pays a (code)", "flag a"],
  nomB: ["joueur b", "joueurb", "nom b"],
  tagB: ["tag b", "tagb", "equipe b", "sponsor b"],
  paysB: ["pays b", "paysb", "pays b (code)", "flag b"],
} as const;

type MatchColumnKey = keyof typeof MATCH_COLUMNS;

function matchColumnIndexes(headerRow: unknown[]): Record<MatchColumnKey, number> {
  const normalizedHeaders = headerRow.map(normalize);
  const indexes = {} as Record<MatchColumnKey, number>;

  for (const key of Object.keys(MATCH_COLUMNS) as MatchColumnKey[]) {
    const aliases: readonly string[] = MATCH_COLUMNS[key];
    const idx = normalizedHeaders.findIndex((h) => aliases.includes(h));
    indexes[key] = idx;
  }

  return indexes;
}

/**
 * Repère la ligne d'en-tête réelle de l'onglet "Matchs" — pas forcément la
 * toute première ligne de la feuille : les modèles générés placent une
 * légende (rappel de la convention "TBD_", sens de "Groupe" pour ce
 * format...) au-dessus de la vraie ligne d'en-têtes, pour qu'elle reste
 * visible sans avoir à ouvrir un onglet séparé. On cherche donc la première
 * ligne contenant à la fois "Joueur A" et "Joueur B" (une correspondance
 * exacte après normalisation, pas une sous-chaîne — une légende en texte
 * libre ne matche donc jamais par erreur), plutôt que de supposer que
 * l'en-tête est toujours en position 0.
 */
function findHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const normalizedHeaders = rows[i].map(normalize);
    const hasNomA = MATCH_COLUMNS.nomA.some((alias) => normalizedHeaders.includes(alias));
    const hasNomB = MATCH_COLUMNS.nomB.some((alias) => normalizedHeaders.includes(alias));
    if (hasNomA && hasNomB) return i;
  }
  return -1;
}

function cellString(row: unknown[], index: number): string | null {
  if (index === -1) return null;
  const value = row[index];
  if (value == null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

/** Préfixe fixe marquant un compétiteur pas encore déterminé (ex. "TBD_Vainqueur QF1"). */
const TBD_PREFIX = /^tbd_/i;

interface ParsedCompetitorField {
  competitor: ParsedCompetitor | null;
  /** Description après le préfixe "TBD_" (ex. "Vainqueur QF1"), null si la cellule n'est pas un placeholder. */
  placeholder: string | null;
}

/**
 * Une cellule "Joueur A/B" commençant par "TBD_" (insensible à la casse) ne
 * désigne pas un vrai compétiteur mais un slot en attente (round suivant
 * d'un bracket, appariement suisse pas encore calculé...) — voir
 * ParsedMatch.placeholderA/B. Stockée comme description libre, jamais
 * comme un faux nom de joueur en base (voir lib/invitationalEvents.ts).
 */
function parseCompetitorField(
  row: unknown[],
  nameIdx: number,
  tagIdx: number,
  countryIdx: number,
): ParsedCompetitorField {
  const name = cellString(row, nameIdx);
  if (!name) return { competitor: null, placeholder: null };

  if (TBD_PREFIX.test(name)) {
    const description = name.replace(TBD_PREFIX, "").trim();
    return { competitor: null, placeholder: description || "À déterminer" };
  }

  return {
    competitor: {
      name,
      tag: cellString(row, tagIdx),
      countryCode: cellString(row, countryIdx)?.toUpperCase().slice(0, 2) ?? null,
    },
    placeholder: null,
  };
}

function parseMatchRows(rows: unknown[][]): ParsedMatch[] {
  if (rows.length === 0) {
    throw new InvitationalImportError('Onglet "Matchs" vide (aucune ligne de données).');
  }

  const headerIdx = findHeaderRowIndex(rows);
  if (headerIdx === -1) {
    throw new InvitationalImportError(
      'Onglet "Matchs" : colonnes "Joueur A" et "Joueur B" introuvables. ' +
        "Vérifie les en-têtes de colonnes (voir la documentation du format d'import).",
    );
  }
  const headerRow = rows[headerIdx];
  const dataRows = rows.slice(headerIdx + 1);
  const columns = matchColumnIndexes(headerRow);

  const matches: ParsedMatch[] = [];
  dataRows.forEach((row, i) => {
    const fieldA = parseCompetitorField(row, columns.nomA, columns.tagA, columns.paysA);
    const fieldB = parseCompetitorField(row, columns.nomB, columns.tagB, columns.paysB);
    // Ligne vide (aucun nom ni placeholder d'aucun côté), ignorée
    // silencieusement — une ligne avec au moins un placeholder "TBD_" reste
    // un match réel à créer, pas une ligne vide.
    if (!fieldA.competitor && !fieldA.placeholder && !fieldB.competitor && !fieldB.placeholder) return;

    const rawOrder = columns.ordre !== -1 ? row[columns.ordre] : null;
    const orderIndex =
      typeof rawOrder === "number" && Number.isFinite(rawOrder) ? rawOrder : i + 1;

    matches.push({
      groupLabel: cellString(row, columns.groupe),
      orderIndex,
      competitorA: fieldA.competitor,
      placeholderA: fieldA.placeholder,
      competitorB: fieldB.competitor,
      placeholderB: fieldB.placeholder,
    });
  });

  if (matches.length === 0) {
    throw new InvitationalImportError('Onglet "Matchs" : aucun match valide trouvé (lignes toutes vides).');
  }

  return matches;
}

function findSheetName(sheetNames: string[], wanted: string): string | undefined {
  return sheetNames.find((n) => normalize(n) === wanted);
}

/**
 * Parse un fichier d'import Invitational/Prestataire (.xlsx ou .csv) — voir
 * docs/invitational-import-format.md pour la structure attendue. Ignore
 * volontairement tout onglet "Rundown" (destiné au showrunner, pas à
 * l'outil). Fonction pure côté résultat (aucun accès DB) : le dédoublonnage
 * des compétiteurs par nom au sein de l'event se fait séparément, voir
 * buildCompetitorRoster.
 */
export function parseInvitationalWorkbook(
  buffer: Buffer | Uint8Array,
  filename: string,
): ParsedInvitationalImport {
  const isCsv = /\.csv$/i.test(filename);

  let workbook: XLSX.WorkBook;
  try {
    workbook = isCsv
      ? XLSX.read(buffer, { type: "buffer", raw: true })
      : XLSX.read(buffer, { type: "buffer" });
  } catch (err) {
    throw new InvitationalImportError(
      "Impossible de lire le fichier — vérifie qu'il s'agit bien d'un .xlsx ou .csv valide.",
      { cause: err },
    );
  }

  if (isCsv) {
    // Un CSV ne peut contenir qu'une seule table : par convention, la
    // première ligne non vide est "Format,VALEUR", suivie d'une ligne
    // vide, puis de l'onglet "Matchs" habituel (en-têtes + lignes) — voir
    // docs/invitational-import-format.md.
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: true });
    const blankIndex = rows.findIndex(isBlankRow);
    if (blankIndex === -1 || blankIndex === 0) {
      throw new InvitationalImportError(
        "CSV : première ligne attendue \"Format,VALEUR\" suivie d'une ligne vide avant le tableau des matchs.",
      );
    }
    const format = parseFormatValue(rows[0]?.[1]);
    const matchRows = rows.slice(blankIndex + 1).filter((r) => r.length > 0);
    return { format, matches: parseMatchRows(matchRows) };
  }

  const infoSheetName = findSheetName(workbook.SheetNames, INFO_SHEET_NAME);
  if (!infoSheetName) {
    throw new InvitationalImportError('Onglet "Info" introuvable dans le fichier.');
  }
  const infoRows: unknown[][] = XLSX.utils.sheet_to_json(workbook.Sheets[infoSheetName], {
    header: 1,
  });
  const formatRow = infoRows.find((r) => normalize(r[0]) === "format");
  if (!formatRow) {
    throw new InvitationalImportError(
      'Onglet "Info" : ligne "Format" introuvable (colonne A = "Format", colonne B = la valeur).',
    );
  }
  const format = parseFormatValue(formatRow[1]);

  const matchesSheetName = findSheetName(workbook.SheetNames, MATCHES_SHEET_NAME);
  if (!matchesSheetName) {
    throw new InvitationalImportError('Onglet "Matchs" introuvable dans le fichier.');
  }
  const matchRows: unknown[][] = XLSX.utils.sheet_to_json(workbook.Sheets[matchesSheetName], {
    header: 1,
  });

  return { format, matches: parseMatchRows(matchRows) };
}

/**
 * Déduplique les compétiteurs par nom (insensible à la casse/aux espaces)
 * au sein d'un même import, pour qu'un joueur apparaissant dans plusieurs
 * matchs de l'event pointe vers la même entrée (nécessaire pour que sa
 * série de victoires — voir lib/invitationalOdds.ts — se cumule
 * correctement au fil de l'event plutôt que d'être répartie sur des
 * doublons). En cas de tag/pays différents d'une apparition à l'autre,
 * garde la première rencontrée.
 */
export function buildCompetitorRoster(matches: ParsedMatch[]): ParsedCompetitor[] {
  const byName = new Map<string, ParsedCompetitor>();
  for (const match of matches) {
    for (const competitor of [match.competitorA, match.competitorB]) {
      if (!competitor) continue;
      const key = normalize(competitor.name);
      if (!byName.has(key)) byName.set(key, competitor);
    }
  }
  return Array.from(byName.values());
}
