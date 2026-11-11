// Tower v2 (PM 2026-11-11) — plain-language sentences for the control tower, so that a stand-in
// with no training understands the situation. Pure display: no business rule is added here.

import type { ActionType } from "@/lib/engine/actions";
import { BUSINESS_DAYS, type Step } from "@/lib/engine/config";
import type { ControlResult, Level } from "@/lib/engine/controls";
import { getDefaultPerson, type PersonId } from "@/lib/engine/people";
import { STEP_NAMES } from "./steps";

/** 438 → « 7 h 18 », 60 → « 1 h », 48 → « 48 min ». Sign is ignored. */
export function formatDuration(minutes: number): string {
  const m = Math.round(Math.abs(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${String(rest).padStart(2, "0")}`;
}

/** « manque 1 h », « pile à l'heure », « 7 h 18 d'avance ». */
export function marginPhrase(margin: number): string {
  if (margin < 0) return `manque ${formatDuration(margin)}`;
  if (margin === 0) return "pile à l'heure";
  return `${formatDuration(margin)} d'avance`;
}

/** « Alice », « Bob et Charlie », « Alice, Bob et Charlie ». */
export function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} et ${words[words.length - 1]}`;
}

export function names(ids: readonly PersonId[]): string {
  return joinWords(ids.map((id) => getDefaultPerson(id).name));
}

/** « l'étape « Créer l'offre » (S3) », or « l'ensemble du travail » for the global control. */
export function controlTarget(id: ControlResult["id"]): string {
  return id === "global" ? "l'ensemble du travail" : `l'étape « ${STEP_NAMES[id as Step]} » (${id})`;
}

/** Same tie-break as the engine (R11): lowest margin, first in S2, S3, S4, S5, global order. */
export function worstControl(controls: readonly ControlResult[]): ControlResult | null {
  if (controls.length === 0) return null;
  return controls.reduce((w, c) => (c.margin < w.margin ? c : w));
}

export function daysLeft(today: number): number {
  return Math.max(0, BUSINESS_DAYS - today + 1);
}

/** « absence J5 et J6 »: absences of the last 5 business days, today and the days to come. */
export function absenceNote(absentDays: readonly number[], today: number): string | null {
  const days = absentDays.filter((d) => d > today - 5);
  return days.length > 0 ? `absence ${joinWords(days.map((d) => `J${d}`))}` : null;
}

export interface Verdict {
  headline: string;
  cause: string;
}

/** Headline and cause for the hero banner, from the worst control (R9, R10). */
export function verdict(
  controls: readonly ControlResult[],
  level: Level,
  absentDaysOf: (id: PersonId) => readonly number[],
  today: number,
): Verdict {
  const worst = worstControl(controls);
  if (!worst) return { headline: "Calcul en cours.", cause: "" };
  const target = controlTarget(worst.id);
  if (level === "green") {
    return {
      headline: "Tout est dans les temps.",
      cause: `Le point le plus juste : ${target}, ${formatDuration(worst.margin)} d'avance d'ici le J${worst.deadlineDay}.`,
    };
  }
  const headline =
    worst.margin < 0
      ? `Il manque ${formatDuration(worst.margin)} de travail sur ${target} pour tenir le J${worst.deadlineDay}.`
      : worst.margin === 0
        ? `C'est juste : ${target} est pile à l'heure pour le J${worst.deadlineDay}.`
        : `C'est juste : ${target} n'a plus que ${formatDuration(worst.margin)} d'avance d'ici le J${worst.deadlineDay}.`;

  let cause: string;
  if (worst.id === "global") cause = "Toute l'équipe est concernée.";
  else if (worst.competent.length === 1) {
    const id = worst.competent[0];
    const note = absenceNote(absentDaysOf(id), today);
    cause = `${getDefaultPerson(id).name} est la seule personne qui sait faire cette étape${note ? ` (${note})` : ""}.`;
  } else cause = `Personnes qui peuvent faire cette étape : ${names(worst.competent)}.`;
  if (controls.every((c) => c === worst || c.level === "green")) cause += " Les autres étapes sont dans les temps.";
  return { headline, cause };
}

/** Published offers compared with the reference trajectory, at the end of yesterday. */
export function planGap(actual: readonly number[], reference: readonly number[] | null, today: number): { day: number; planned: number; gap: number } | null {
  if (!reference || today < 2) return null;
  const i = today - 2;
  if (actual[i] === undefined || reference[i] === undefined) return null;
  return { day: today - 1, planned: reference[i], gap: reference[i] - actual[i] };
}

export function actionTitle(type: ActionType, personId: PersonId | null): string {
  switch (type) {
    case "EXTRA_HOUR":
      return `Heure exceptionnelle : ${personId ? getDefaultPerson(personId).name : "une personne"} travaille 1 h de plus`;
    case "RENFORT_S1":
      return "Renfort : vous préparez vous-même du contenu (S1), 1 h par jour";
    case "FORCE_ORDER":
      return "Forcer l'ordre";
    case "RERANK":
      return "Prioriser les marchands importants";
  }
}

export type EffectTag = "fix" | "better" | "none";

// « Comble le manque » rather than « Règle le problème »: the global level can stay orange (or red,
// because of another step) after the shortage on the worst step is filled.
export const EFFECT_TAG_LABEL: Record<EffectTag, string> = {
  fix: "Comble le manque",
  better: "Améliore",
  none: "Ne règle pas le problème",
};

const LEVEL_FROM: Record<Level, string> = { red: "du rouge", orange: "de l'orange", green: "du vert" };
const LEVEL_TO: Record<Level, string> = { red: "au rouge", orange: "à l'orange", green: "au vert" };

/** R10 in plain words: what an orange or red level means once an action is applied. « Point », as in
 *  the green verdict, because the worst control can be the global one. */
export const LEVEL_MEANING: Record<Exclude<Level, "green">, string> = {
  orange: "plus rien ne manque, mais au moins un point a 1 h d'avance ou moins",
  red: "au moins un point manque encore de temps",
};

/** What happens after « Appliquer », so the stand-in knows whether to act again. */
export function levelAfterNote(levelBefore: Level, levelAfter: Level, tag: EffectTag): string {
  if (levelAfter !== levelBefore) {
    return levelAfter === "green"
      ? ` Le niveau passe ${LEVEL_FROM[levelBefore]} ${LEVEL_TO[levelAfter]}.`
      : ` Le niveau passe ${LEVEL_FROM[levelBefore]} ${LEVEL_TO[levelAfter]} : ${LEVEL_MEANING[levelAfter]}.`;
  }
  // The worst step is filled but another one is still short (R10: red stays red).
  if (tag === "fix" && levelAfter === "red") return " Le niveau reste rouge : un autre point manque encore de temps.";
  return "";
}

/** « Niveau maintenant : Orange, plus rien ne manque… », shown under the confirmation of an action. */
export function levelNowNote(level: Level): string {
  if (level === "green") return "Niveau maintenant : Vert, tout est dans les temps.";
  return `Niveau maintenant : ${level === "orange" ? "Orange" : "Rouge"}, ${LEVEL_MEANING[level]}.`;
}

/** The person must agree first: the app sends nothing to the people concerned. */
export function askFirstNote(personId: PersonId, day: number): string {
  return `Avant d'appliquer : demander son accord à ${getDefaultPerson(personId).name} pour le J${day}. L'application n'envoie aucun message.`;
}

/** Confirmation that stays on the tower after « Appliquer » (the row itself is recalculated). */
export function appliedNote(type: ActionType, personId: PersonId | null, day: number | null): string {
  if (type === "EXTRA_HOUR" && personId && day !== null) {
    const name = getDefaultPerson(personId).name;
    return `Enregistré : ${name} a 1 h de plus le J${day}. Si ce n'est pas déjà fait, prévenir ${name} : l'application n'envoie aucun message.`;
  }
  if (type === "RENFORT_S1") return "Enregistré : le renfort est en place. L'onglet « Mes tâches » est maintenant ouvert pour vous.";
  return "Enregistré : l'action est en place.";
}

/** Effect of an action on the worst control, from the impact preview (US-18), in one sentence. */
export function actionEffect(
  type: ActionType,
  worst: ControlResult,
  marginAfter: number,
  levelBefore: Level,
  levelAfter: Level,
  personId: PersonId | null,
): { tag: EffectTag; text: string } {
  const before = worst.margin;
  const target = controlTarget(worst.id);
  const who = type === "EXTRA_HOUR" && personId ? getDefaultPerson(personId).name : "L'équipe";
  let tag: EffectTag;
  let text: string;
  if (marginAfter > before && before < 0 && marginAfter >= 0) {
    tag = "fix";
    text = `${who} a alors assez de temps pour ${target}.`;
  } else if (marginAfter > before) {
    tag = "better";
    text =
      marginAfter < 0
        ? `Ça aide, mais il manquera encore ${formatDuration(marginAfter)} pour ${target}.`
        : `${target[0].toUpperCase()}${target.slice(1)} passe de ${formatDuration(before)} à ${formatDuration(marginAfter)} d'avance.`;
  } else {
    tag = "none";
    text =
      type === "RENFORT_S1"
        ? `L'équipe gagne du temps, mais pas pour ${target}${before < 0 ? ` : il manque toujours ${formatDuration(before)}` : ""}.`
        : `Ne change rien pour ${target}.`;
  }
  text += levelAfterNote(levelBefore, levelAfter, tag);
  return { tag, text };
}
