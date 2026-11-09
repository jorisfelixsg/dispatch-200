// R12 — Absences.

import { consumedOn, dayBudget } from "./budget";
import type { PersonId } from "./people";
import { currentDay } from "./state";
import type { DayAdjustment, WorldState } from "./types";

function upsertAdjustment(
  state: WorldState,
  personId: PersonId,
  dayIndex: number,
  update: (a: DayAdjustment) => DayAdjustment,
): WorldState {
  const existing = state.adjustments.find((a) => a.personId === personId && a.dayIndex === dayIndex);
  const base: DayAdjustment = existing ?? { personId, dayIndex, extraMin: 0, absentDeclared: false, absentDetected: false };
  return { ...state, adjustments: [...state.adjustments.filter((a) => a !== existing), update(base)] };
}

export type DeclareAbsenceResult = { ok: true; state: WorldState } | { ok: false; error: "past_day" };

/** Declared absence, for today or a future day: the day's budget becomes 0. */
export function declareAbsence(state: WorldState, personId: PersonId, dayIndex: number): DeclareAbsenceResult {
  const today = currentDay(state);
  if (today === null || dayIndex < today) return { ok: false, error: "past_day" };
  return { ok: true, state: upsertAdjustment(state, personId, dayIndex, (a) => ({ ...a, absentDeclared: true })) };
}

/**
 * Detected absence, evaluated when the clock moves past `dayIndex`: a person who had a budget
 * that day (so no declared absence) and consumed nothing. No retroactive effect on the budget.
 */
export function detectAbsences(state: WorldState, dayIndex: number): PersonId[] {
  return state.people
    .filter((p) => dayBudget(state, p.id, dayIndex) > 0 && consumedOn(state, p.id, dayIndex) === 0)
    .map((p) => p.id);
}

export function markAbsencesDetected(state: WorldState, personIds: readonly PersonId[], dayIndex: number): WorldState {
  return personIds.reduce(
    (s, id) => upsertAdjustment(s, id, dayIndex, (a) => ({ ...a, absentDetected: true })),
    state,
  );
}
