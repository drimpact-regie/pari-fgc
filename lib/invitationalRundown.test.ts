import { describe, expect, it } from "vitest";

import { computeSchedule, computeSetDuration, type RundownConfig, type RundownSetInput } from "./invitationalRundown";

const CONFIG: RundownConfig = {
  minSecondsPerRound: 25,
  maxSecondsPerRound: 60,
  setupSeconds: 120,
  verifSeconds: 30,
  startAt: new Date("2026-01-01T18:00:00Z"),
};

function hm(date: Date | null): string {
  if (!date) return "null";
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`;
}

describe("computeSetDuration", () => {
  it("computes min/max duration from FT/rounds, with verif manette added when applicable", () => {
    const set: RundownSetInput = { id: "1", ftGames: 3, roundsPerGame: 2, verifManette: true };
    const { minSeconds, maxSeconds } = computeSetDuration(set, CONFIG);
    // min = 25 * 2 * 3 + 30 = 180 ; max = 60 * (2*2-1) * (2*3-1) + 30 = 60*3*5+30 = 930
    expect(minSeconds).toBe(180);
    expect(maxSeconds).toBe(930);
  });

  it("omits verif manette duration when not applicable", () => {
    const set: RundownSetInput = { id: "2", ftGames: 3, roundsPerGame: 2, verifManette: false };
    const { minSeconds, maxSeconds } = computeSetDuration(set, CONFIG);
    expect(minSeconds).toBe(150);
    expect(maxSeconds).toBe(900);
  });

  it("returns null when the set structure isn't configured", () => {
    expect(computeSetDuration({ id: "3", ftGames: null, roundsPerGame: 2, verifManette: false }, CONFIG)).toEqual({
      minSeconds: null,
      maxSeconds: null,
    });
    expect(computeSetDuration({ id: "4", ftGames: 3, roundsPerGame: null, verifManette: false }, CONFIG)).toEqual({
      minSeconds: null,
      maxSeconds: null,
    });
  });
});

describe("computeSchedule — parity with the validated Excel Rundown", () => {
  // Mêmes valeurs d'entrée que le fichier "1-bracket_simple_elimination.xlsx"
  // livré à l'utilisateur et vérifiées à la main + via LibreOffice dans
  // l'échange précédent — les horaires attendus ci-dessous sont recopiés
  // depuis cette vérification, pour garantir que le calcul côté site
  // produit exactement les mêmes résultats que le classeur Excel.
  const sets: RundownSetInput[] = [
    { id: "qf1", ftGames: 3, roundsPerGame: 2, verifManette: true }, // SonicFox vs Leffen
    { id: "qf2", ftGames: 3, roundsPerGame: 2, verifManette: false }, // Kayozz vs Punk
    { id: "qf3", ftGames: 3, roundsPerGame: 2, verifManette: false }, // Verlin vs Rise
    { id: "qf4", ftGames: 3, roundsPerGame: 2, verifManette: false }, // Dogura vs ElChoya
    { id: "sf1", ftGames: 3, roundsPerGame: 2, verifManette: false }, // Demi-finale 1
    { id: "sf2", ftGames: 3, roundsPerGame: 2, verifManette: false }, // Demi-finale 2
    { id: "final", ftGames: 5, roundsPerGame: 2, verifManette: true }, // Finale
  ];

  const expected = [
    { min: "18:02:00", max: "18:02:00" },
    { min: "18:07:00", max: "18:19:30" },
    { min: "18:11:30", max: "18:36:30" },
    { min: "18:16:00", max: "18:53:30" },
    { min: "18:20:30", max: "19:10:30" },
    { min: "18:25:00", max: "19:27:30" },
    { min: "18:29:30", max: "19:44:30" },
  ];

  const estimates = computeSchedule(sets, CONFIG);

  it.each(expected.map((e, i) => [i, e] as const))("set %i start time matches the Excel-verified value", (i, e) => {
    expect(hm(estimates[i].startMin)).toBe(e.min);
    expect(hm(estimates[i].startMax)).toBe(e.max);
  });

  it("computes the same durations as the Excel formula for every set", () => {
    expect(estimates[0]).toMatchObject({ durationMinSeconds: 180, durationMaxSeconds: 930 });
    expect(estimates[1]).toMatchObject({ durationMinSeconds: 150, durationMaxSeconds: 900 });
    expect(estimates[6]).toMatchObject({ durationMinSeconds: 280, durationMaxSeconds: 1650 });
  });
});

describe("computeSchedule — edited FT/rounds cascades to all following sets", () => {
  it("re-flows every subsequent estimate when an earlier set's format changes (same behavior verified in Excel)", () => {
    const sets: RundownSetInput[] = [
      { id: "qf1", ftGames: 3, roundsPerGame: 2, verifManette: true },
      { id: "qf2", ftGames: 5, roundsPerGame: 3, verifManette: false }, // edited FT3->FT5, rounds 2->3
      { id: "qf3", ftGames: 3, roundsPerGame: 2, verifManette: false },
    ];
    const estimates = computeSchedule(sets, CONFIG);
    // qf2 duration: min = 25*3*5=375, max = 60*5*9=2700
    expect(estimates[1]).toMatchObject({ durationMinSeconds: 375, durationMaxSeconds: 2700 });
    // qf3 start shifts accordingly: 18:07 + 375s(6:15) + 2:00 = 18:15:15 ; 18:19:30 + 2700s(45:00) + 2:00 = 19:06:30
    expect(hm(estimates[2].startMin)).toBe("18:15:15");
    expect(hm(estimates[2].startMax)).toBe("19:06:30");
  });
});

describe("computeSchedule — resilience to an incomplete set", () => {
  it("doesn't crash and keeps advancing the cursor by setup time alone for a set missing FT/rounds", () => {
    const sets: RundownSetInput[] = [
      { id: "a", ftGames: 3, roundsPerGame: 2, verifManette: false },
      { id: "b", ftGames: null, roundsPerGame: null, verifManette: null },
      { id: "c", ftGames: 3, roundsPerGame: 2, verifManette: false },
    ];
    const estimates = computeSchedule(sets, CONFIG);
    expect(estimates[1].durationMinSeconds).toBeNull();
    expect(estimates[1].startMin).not.toBeNull();
    expect(estimates[2].startMin).not.toBeNull();
  });
});
