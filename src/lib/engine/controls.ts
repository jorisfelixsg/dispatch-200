// R9 — Capacity controls (control tower) and R10 — levels.

import { BUSINESS_DAYS, CONTROL_DEADLINES, GREEN_MARGIN_MIN, STEPS, type Step } from "./config";
import { consumedOn, dayBudget } from "./budget";
import type { PersonId } from "./people";
import { currentDay, duration, effectivePerson } from "./state";
import type { WorldState } from "./types";

export type ControlId = "S2" | "S3" | "S4" | "S5" | "global";
export const CONTROL_IDS: readonly ControlId[] = ["S2", "S3", "S4", "S5", "global"];

export type Level = "green" | "orange" | "red";

export interface ControlResult {
  id: ControlId;
  deadlineDay: number;
  /** Minutes still needed. */
  need: number;
  /** Σ capRest of competent people, minus their engagement on steps only they can do. */
  capacity: number;
  margin: number;
  marginDays: number;
  level: Level;
  /** People competent for the step (every person with a budget for the global control). */
  competent: PersonId[];
}

/**
 * capRest(p, until Jd) = budget left today + budgets of the following business days up to Jd
 * inclusive. A declared absence counts 0; extra minutes are added. Nothing counts after Jd.
 */
export function capRest(state: WorldState, personId: PersonId, untilDay: number): number {
  const today = currentDay(state);
  if (today === null || today > untilDay) return 0;
  let total = Math.max(0, dayBudget(state, personId, today) - consumedOn(state, personId, today));
  for (let d = today + 1; d <= Math.min(untilDay, BUSINESS_DAYS); d++) total += dayBudget(state, personId, d);
  return total;
}

/** Number of offers where the step is not done yet. */
export function remainingCount(state: WorldState, step: Step): number {
  const done = new Set(state.executions.filter((e) => e.step === step).map((e) => e.offerId));
  return state.offers.filter((o) => !done.has(o.id)).length;
}

function competentFor(state: WorldState, step: Step): PersonId[] {
  const day = currentDay(state) ?? 0;
  return state.people.filter((p) => effectivePerson(state, p.id, day).skills.includes(step)).map((p) => p.id);
}

/** Remaining load of the OTHER steps for which the person is the only competent one. */
function engagement(state: WorldState, personId: PersonId, excluded: Step): number {
  let total = 0;
  for (const step of STEPS) {
    if (step === excluded) continue;
    const competent = competentFor(state, step);
    if (competent.length === 1 && competent[0] === personId) total += remainingCount(state, step) * duration(step);
  }
  return total;
}

/** R10 — green if margin > 60 min, orange if 0 ≤ margin ≤ 60, red if margin < 0. */
export function levelOf(margin: number): Level {
  if (margin > GREEN_MARGIN_MIN) return "green";
  if (margin >= 0) return "orange";
  return "red";
}

const LEVEL_SEVERITY: Record<Level, number> = { green: 0, orange: 1, red: 2 };

/** R10 — the global level is the worst of the five controls. */
export function worstLevel(levels: readonly Level[]): Level {
  return levels.reduce<Level>((worst, l) => (LEVEL_SEVERITY[l] > LEVEL_SEVERITY[worst] ? l : worst), "green");
}

function result(id: ControlId, need: number, capacity: number, competent: PersonId[]): ControlResult {
  const margin = capacity - need;
  return { id, deadlineDay: CONTROL_DEADLINES[id], need, capacity, margin, marginDays: margin / 60, level: levelOf(margin), competent };
}

export function computeControl(state: WorldState, id: ControlId): ControlResult {
  const deadline = CONTROL_DEADLINES[id];
  if (id === "global") {
    const need = STEPS.reduce((sum, s) => sum + remainingCount(state, s) * duration(s), 0);
    const people = state.people.map((p) => p.id);
    const capacity = people.reduce((sum, p) => sum + capRest(state, p, deadline), 0);
    return result(id, need, capacity, people.filter((p) => capRest(state, p, deadline) > 0));
  }
  const need = remainingCount(state, id) * duration(id);
  const competent = competentFor(state, id);
  const capacity = competent.reduce((sum, p) => sum + capRest(state, p, deadline) - engagement(state, p, id), 0);
  return result(id, need, capacity, competent);
}

export interface ControlsReport {
  controls: ControlResult[];
  level: Level;
}

export function computeControls(state: WorldState): ControlsReport {
  const controls = CONTROL_IDS.map((id) => computeControl(state, id));
  return { controls, level: worstLevel(controls.map((c) => c.level)) };
}
