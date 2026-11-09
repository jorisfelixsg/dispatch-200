// R13 — Simulated clock (only the orchestrator changes it; it never goes back, except by reset).

import { BUSINESS_DAYS, DAY_END, DAY_START } from "./config";
import { SIM_END, simAt, toSimDate } from "./time";

/** Business day of a simulated minute, or null on a weekend. */
export function businessDayOf(sim: number): number | null {
  return toSimDate(sim).dayIndex;
}

/** Start (08:00) of business day `dayIndex`; "start of J23" is the end of the month (J22 19:00). */
export function startOfBusinessDay(dayIndex: number): number {
  return dayIndex > BUSINESS_DAYS ? SIM_END : simAt(Math.max(1, dayIndex), DAY_START);
}

function clampToEnd(sim: number): number {
  return Math.min(sim, SIM_END);
}

/** "Jour suivant": next business day at 08:00 (bounded by J22 19:00). */
export function nextBusinessDay(now: number): number {
  const day = businessDayOf(now);
  if (day === null) throw new Error(`Clock on a weekend: ${now}`);
  return clampToEnd(startOfBusinessDay(day + 1));
}

/** "+1h" / "+2h": past 19:00, the clock moves to the next business day at 08:00. */
export function advanceHours(now: number, hours: number): number {
  const target = now + hours * 60;
  const date = toSimDate(now);
  const sameDay = toSimDate(target).calendarDay === date.calendarDay;
  if (!sameDay || toSimDate(target).minuteOfDay > DAY_END) return nextBusinessDay(now);
  return clampToEnd(target);
}

/** "Aller au début de Jx": never moves the clock backwards. */
export function goToDayStart(now: number, dayIndex: number): number {
  return Math.max(now, clampToEnd(startOfBusinessDay(dayIndex)));
}

/** J22 19:00 reached: the UI shows « Fin du mois ». */
export function isEndOfMonth(now: number): boolean {
  return now >= SIM_END;
}

/** Business days left behind when the clock moves from `from` to `to` (used for R12 detection). */
export function endedBusinessDays(from: number, to: number): number[] {
  const a = businessDayOf(from);
  const b = businessDayOf(to);
  if (a === null || b === null) return [];
  const days: number[] = [];
  for (let d = a; d < b; d++) days.push(d);
  return days;
}
