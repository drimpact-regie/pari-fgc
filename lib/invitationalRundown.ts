/**
 * Estimation d'horaires par set (Rundown), reproduisant côté site
 * exactement la même formule que le fichier Excel Rundown livré aux
 * admins pour préparer un event Invitational/Prestataire — voir
 * docs/invitational-import-format.md. Utilisé pour l'encart "prochains
 * matchs" de l'overlay bracket (/overlay/invitational/[eventId]/bracket),
 * en s'appuyant sur les mêmes colonnes de structure de set (Format FT /
 * Rounds par manche / Vérif manette) désormais importées en base plutôt
 * que jamais lues.
 *
 * Formule (identique à l'Excel) :
 * - Durée minimale = temps le plus court par round × rounds par manche × FT
 *   [+ durée vérification manette si applicable]
 * - Durée maximale = temps le plus long par round × (2×rounds−1) × (2×FT−1)
 *   [+ durée vérification manette si applicable]
 * - Horaire de départ du set k = horaire de départ du set (k-1)
 *   + durée du set (k-1) + temps d'installation, en partant de l'heure de
 *   début de l'event pour le premier set.
 */

export interface RundownConfig {
  minSecondsPerRound: number;
  maxSecondsPerRound: number;
  setupSeconds: number;
  verifSeconds: number;
  startAt: Date;
}

export interface RundownSetInput {
  id: string;
  ftGames: number | null;
  roundsPerGame: number | null;
  verifManette: boolean | null;
}

export interface SetDuration {
  minSeconds: number | null;
  maxSeconds: number | null;
}

export interface RundownEstimate {
  id: string;
  durationMinSeconds: number | null;
  durationMaxSeconds: number | null;
  startMin: Date | null;
  startMax: Date | null;
}

/**
 * Durée min/max d'un set isolé. `null` si la structure du set (FT / rounds
 * par manche) n'est pas renseignée — rien à estimer pour ce set.
 */
export function computeSetDuration(
  set: RundownSetInput,
  config: Pick<RundownConfig, "minSecondsPerRound" | "maxSecondsPerRound" | "verifSeconds">,
): SetDuration {
  if (!set.ftGames || !set.roundsPerGame || set.ftGames < 1 || set.roundsPerGame < 1) {
    return { minSeconds: null, maxSeconds: null };
  }
  const verif = set.verifManette ? config.verifSeconds : 0;
  const minSeconds = config.minSecondsPerRound * set.roundsPerGame * set.ftGames + verif;
  const maxSeconds =
    config.maxSecondsPerRound * (2 * set.roundsPerGame - 1) * (2 * set.ftGames - 1) + verif;
  return { minSeconds, maxSeconds };
}

/**
 * Cumule les durées set par set, dans l'ordre fourni (voir
 * `orderIndex` — l'ordre global d'affichage d'un event, tous groupes
 * confondus), pour estimer l'horaire de passage de chacun. Un set sans
 * structure renseignée n'interrompt pas la chaîne pour les suivants : son
 * horaire reste estimé à partir du curseur courant, mais sa propre durée
 * n'avance pas le curseur (rien à ajouter puisqu'inconnue) — un choix plus
 * robuste que le classeur Excel (où une case FT vide casse l'estimation de
 * tous les sets suivants), sans changer le résultat sur des données
 * complètes.
 */
export function computeSchedule(sets: RundownSetInput[], config: RundownConfig): RundownEstimate[] {
  const estimates: RundownEstimate[] = [];
  let cursorMin = config.startAt.getTime();
  let cursorMax = config.startAt.getTime();

  for (const set of sets) {
    cursorMin += config.setupSeconds * 1000;
    cursorMax += config.setupSeconds * 1000;

    const startMin = new Date(cursorMin);
    const startMax = new Date(cursorMax);
    const { minSeconds, maxSeconds } = computeSetDuration(set, config);

    estimates.push({
      id: set.id,
      durationMinSeconds: minSeconds,
      durationMaxSeconds: maxSeconds,
      startMin,
      startMax,
    });

    if (minSeconds != null) cursorMin += minSeconds * 1000;
    if (maxSeconds != null) cursorMax += maxSeconds * 1000;
  }

  return estimates;
}
