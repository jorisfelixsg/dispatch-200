// R4 — Daily budget (and R12: a declared absence sets the day's budget to 0).

import type { PersonId } from "./people";
import { currentDay, effectivePerson } from "./state";
import type { DayAdjustment, WorldState } from "./types";

export function adjustmentFor(state: WorldState, personId: PersonId, dayIndex: number): DayAdjustment | undefined {
  return state.adjustments.find((a) => a.personId === personId && a.dayIndex === dayIndex);
}

/** Budget of a day = daily_budget_min + extra_min, or 0 if an absence is declared. */
export function dayBudget(state: WorldState, personId: PersonId, dayIndex: number): number {
  const adjustment = adjustmentFor(state, personId, dayIndex);
  if (adjustment?.absentDeclared) return 0;
  return effectivePerson(state, personId, dayIndex).dailyBudgetMin + (adjustment?.extraMin ?? 0);
}

/** Minutes consumed by the person on that day (sum of the durations of the steps they validated). */
export function consumedOn(state: WorldState, personId: PersonId, dayIndex: number): number {
  return state.sessions.find((s) => s.personId === personId && s.dayIndex === dayIndex)?.consumedMin ?? 0;
}

export interface BudgetStatus {
  dayIndex: number | null;
  budget: number;
  consumed: number;
  /** Never negative. */
  remaining: number;
  absentDeclared: boolean;
}

/** Budget of the current day (the day of now_sim). */
export function budgetStatus(state: WorldState, personId: PersonId): BudgetStatus {
  const dayIndex = currentDay(state);
  if (dayIndex === null) return { dayIndex, budget: 0, consumed: 0, remaining: 0, absentDeclared: false };
  const budget = dayBudget(state, personId, dayIndex);
  const consumed = consumedOn(state, personId, dayIndex);
  return {
    dayIndex,
    budget,
    consumed,
    remaining: Math.max(0, budget - consumed),
    absentDeclared: Boolean(adjustmentFor(state, personId, dayIndex)?.absentDeclared),
  };
}
