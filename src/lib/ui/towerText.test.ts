import { describe, expect, it } from "vitest";
import { declareAbsence } from "@/lib/engine/absences";
import { computeControls, type ControlResult } from "@/lib/engine/controls";
import { execRange, initialState } from "@/lib/engine/testing/fixtures";
import { simAt } from "@/lib/engine/time";
import type { WorldState } from "@/lib/engine/types";
import {
  absenceNote,
  actionEffect,
  actionTitle,
  appliedNote,
  askFirstNote,
  daysLeft,
  EFFECT_TAG_LABEL,
  formatDuration,
  joinWords,
  levelAfterNote,
  levelNowNote,
  marginPhrase,
  planGap,
  verdict,
  worstControl,
} from "./towerText";

/** R9 example: start of J5, 30 S3 done, Charlie declared absent on J5 and J6 → S3 margin −60. */
function r9Example(): WorldState {
  let state = initialState({
    nowSim: simAt(5, 480),
    executions: [...execRange(1, 30, ["S1", "S2", "S3", "S4"]), ...execRange(31, 100, ["S1", "S2", "S4"])],
  });
  for (const d of [5, 6]) {
    const r = declareAbsence(state, "charlie", d);
    if (r.ok) state = r.state;
  }
  return state;
}

describe("Tower v2 — formatting", () => {
  it("durations in hours and minutes", () => {
    expect([formatDuration(438), formatDuration(60), formatDuration(48), formatDuration(-60), formatDuration(0)]).toEqual([
      "7 h 18",
      "1 h",
      "48 min",
      "1 h",
      "0 min",
    ]);
  });

  it("margins as a shortage, on time or ahead", () => {
    expect([marginPhrase(-60), marginPhrase(0), marginPhrase(510)]).toEqual(["manque 1 h", "pile à l'heure", "8 h 30 d'avance"]);
  });

  it("lists, days left and absences", () => {
    expect([joinWords(["Bob"]), joinWords(["Bob", "Charlie"]), joinWords(["Alice", "Bob", "Charlie"])]).toEqual([
      "Bob",
      "Bob et Charlie",
      "Alice, Bob et Charlie",
    ]);
    expect([daysLeft(1), daysLeft(7), daysLeft(22)]).toEqual([22, 16, 1]);
    expect(absenceNote([5, 6], 7)).toBe("absence J5 et J6");
    expect(absenceNote([1, 9], 7)).toBe("absence J9");
    expect(absenceNote([], 7)).toBeNull();
  });
});

describe("Tower v2 — verdict", () => {
  it("R9 example: a shortage on S3, Charlie is the only person who can do it", () => {
    const state = r9Example();
    const { controls, level } = computeControls(state);
    const v = verdict(controls, level, (id) => (id === "charlie" ? [5, 6] : []), 5);
    expect(v.headline).toBe("Il manque 1 h de travail sur l'étape « Créer l'offre » (S3) pour tenir le J22.");
    expect(v.cause).toMatch(/^Charlie est la seule personne qui sait faire cette étape \(absence J5 et J6\)\./);
  });

  it("green: everything on time, with the tightest step", () => {
    const { controls, level } = computeControls(initialState());
    const v = verdict(controls, level, () => [], 1);
    expect(v.headline).toBe("Tout est dans les temps.");
    expect(v.cause).toBe("Le point le plus juste : l'étape « Créer l'offre » (S3), 2 h d'avance d'ici le J22.");
  });

  it("a shared control names everyone who can do the step", () => {
    const controls = computeControls(initialState()).controls.map((c) => ({ ...c, margin: c.id === "S5" ? 30 : 500, level: c.id === "S5" ? ("orange" as const) : ("green" as const) }));
    const v = verdict(controls, "orange", () => [], 3);
    expect(v.headline).toBe("C'est juste : l'étape « Contrôler et publier » (S5) n'a plus que 30 min d'avance d'ici le J22.");
    expect(v.cause).toBe("Personnes qui peuvent faire cette étape : Bob et Charlie. Les autres étapes sont dans les temps.");
  });
});

describe("Tower v2 — gap with the plan and actions", () => {
  it("compares with the reference at the end of yesterday", () => {
    expect(planGap([0, 4, 12, 20, 22, 26, 26], [0, 4, 12, 22, 33, 44, 55], 7)).toEqual({ day: 6, planned: 44, gap: 18 });
    expect(planGap([0], [0], 1)).toBeNull();
    expect(planGap([0, 1], null, 2)).toBeNull();
  });

  it("an extra hour for Charlie fixes the S3 shortage of the R9 example", () => {
    const worst = worstControl(computeControls(r9Example()).controls) as ControlResult;
    expect(worst.id).toBe("S3");
    expect(actionTitle("EXTRA_HOUR", "charlie")).toBe("Heure exceptionnelle : Charlie travaille 1 h de plus");
    expect(actionEffect("EXTRA_HOUR", worst, 0, "red", "orange", "charlie")).toEqual({
      tag: "fix",
      text: "Charlie a alors assez de temps pour l'étape « Créer l'offre » (S3). Le niveau passe du rouge à l'orange : plus rien ne manque, mais au moins un point a 1 h d'avance ou moins.",
    });
    expect(EFFECT_TAG_LABEL.fix).toBe("Comble le manque");
  });

  it("says when the level stays red because another point is still short", () => {
    expect(levelAfterNote("red", "red", "fix")).toBe(" Le niveau reste rouge : un autre point manque encore de temps.");
    expect(levelAfterNote("red", "red", "better")).toBe("");
    expect(levelAfterNote("orange", "green", "better")).toBe(" Le niveau passe de l'orange au vert.");
    expect(levelNowNote("orange")).toBe("Niveau maintenant : Orange, plus rien ne manque, mais au moins un point a 1 h d'avance ou moins.");
    expect(levelNowNote("green")).toBe("Niveau maintenant : Vert, tout est dans les temps.");
  });

  it("asks to warn the person: the app sends no message", () => {
    expect(askFirstNote("charlie", 7)).toBe("Avant d'appliquer : demander son accord à Charlie pour le J7. L'application n'envoie aucun message.");
    expect(appliedNote("EXTRA_HOUR", "charlie", 7)).toBe(
      "Enregistré : Charlie a 1 h de plus le J7. Si ce n'est pas déjà fait, prévenir Charlie : l'application n'envoie aucun message.",
    );
  });

  it("the S1 reinforcement does not change S3", () => {
    const worst = worstControl(computeControls(r9Example()).controls) as ControlResult;
    expect(actionEffect("RENFORT_S1", worst, worst.margin, "red", "red", null)).toEqual({
      tag: "none",
      text: "L'équipe gagne du temps, mais pas pour l'étape « Créer l'offre » (S3) : il manque toujours 1 h.",
    });
  });

  it("partial help says what is still missing", () => {
    const worst = { ...(worstControl(computeControls(r9Example()).controls) as ControlResult), margin: -120 };
    expect(actionEffect("EXTRA_HOUR", worst, -60, "red", "red", "charlie").text).toBe(
      "Ça aide, mais il manquera encore 1 h pour l'étape « Créer l'offre » (S3).",
    );
  });
});
