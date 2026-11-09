// Control tower indicators (E2): published offers, steps done, current day, and the actual
// cumulative published curve to compare with the reference trajectory (R15, US-15).

import { BUSINESS_DAYS, MINUTES_PER_DAY, STEPS, type Step } from "./config";
import { isEndOfMonth } from "./clock";
import { currentDay } from "./state";
import { calendarDayOfBusinessDay } from "./time";
import type { WorldState } from "./types";

export interface Indicators {
  published: number;
  offerCount: number;
  doneByStep: Record<Step, number>;
  /** Business day of the clock (22 once the month is over). */
  currentDay: number;
  endOfMonth: boolean;
}

export function computeIndicators(state: WorldState): Indicators {
  const doneByStep = Object.fromEntries(STEPS.map((s) => [s, 0])) as Record<Step, number>;
  for (const e of state.executions) doneByStep[e.step] += 1;
  return {
    published: doneByStep.S5,
    offerCount: state.offers.length,
    doneByStep,
    currentDay: currentDay(state) ?? BUSINESS_DAYS,
    endOfMonth: isEndOfMonth(state.nowSim),
  };
}

/** First simulated minute after business day `dayIndex` (midnight that ends the calendar day). */
function endOfBusinessDay(dayIndex: number): number {
  return (calendarDayOfBusinessDay(dayIndex) + 1) * MINUTES_PER_DAY;
}

/**
 * Cumulative published offers at the end of J1 … today (today counts what is done so far).
 * Days after today are not returned: the actual curve stops at the current day.
 */
export function actualCurve(state: WorldState): number[] {
  const today = currentDay(state) ?? BUSINESS_DAYS;
  const s5 = state.executions.filter((e) => e.step === "S5").map((e) => e.doneAtSim);
  const curve: number[] = [];
  for (let d = 1; d <= today; d++) {
    const end = endOfBusinessDay(d);
    curve.push(s5.filter((t) => t < end).length);
  }
  return curve;
}
