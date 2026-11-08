// Pure helpers for the simulated time axis.
// Simulated time = integer minutes since Monday 00:00 of week 1 (J1 = Monday).
// Weekends exist on the axis (they count for the 24h delay) but are never business days.

import {
  BUSINESS_DAYS,
  BUSINESS_DAYS_PER_WEEK,
  DAY_END,
  DAY_START,
  DAYS_PER_WEEK,
  MINUTES_PER_DAY,
} from "./config";

const WEEKDAY_LABELS_FR = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

/** Calendar day offset (0 = Monday of week 1) of business day `dayIndex` (1-based). */
export function calendarDayOfBusinessDay(dayIndex: number): number {
  const zeroBased = dayIndex - 1;
  const week = Math.floor(zeroBased / BUSINESS_DAYS_PER_WEEK);
  const weekday = zeroBased % BUSINESS_DAYS_PER_WEEK;
  return week * DAYS_PER_WEEK + weekday;
}

/** Simulated minute for business day `dayIndex` at `minuteOfDay` (minutes after midnight). */
export function simAt(dayIndex: number, minuteOfDay: number): number {
  return calendarDayOfBusinessDay(dayIndex) * MINUTES_PER_DAY + minuteOfDay;
}

/** Start of the simulation: J1 08:00. */
export const SIM_START = simAt(1, DAY_START);

/** End of the simulation: J22 19:00. */
export const SIM_END = simAt(BUSINESS_DAYS, DAY_END);

export interface SimDate {
  /** 0 = Monday of week 1. */
  calendarDay: number;
  /** 0 = Monday … 6 = Sunday. */
  weekday: number;
  /** Business day index (1-based), or null on weekends. */
  dayIndex: number | null;
  /** Minutes after midnight. */
  minuteOfDay: number;
}

export function toSimDate(sim: number): SimDate {
  const calendarDay = Math.floor(sim / MINUTES_PER_DAY);
  const minuteOfDay = sim - calendarDay * MINUTES_PER_DAY;
  const weekday = calendarDay % DAYS_PER_WEEK;
  const week = Math.floor(calendarDay / DAYS_PER_WEEK);
  const dayIndex =
    weekday < BUSINESS_DAYS_PER_WEEK ? week * BUSINESS_DAYS_PER_WEEK + weekday + 1 : null;
  return { calendarDay, weekday, dayIndex, minuteOfDay };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** "HH:MM" for a minute of day. */
export function formatMinuteOfDay(minuteOfDay: number): string {
  return `${pad2(Math.floor(minuteOfDay / 60))}:${pad2(minuteOfDay % 60)}`;
}

/** Full label used in the top bar, e.g. "J3 · mer. 10:03". */
export function formatSim(sim: number): string {
  const d = toSimDate(sim);
  const dayLabel = d.dayIndex !== null ? `J${d.dayIndex}` : "Week-end";
  return `${dayLabel} · ${WEEKDAY_LABELS_FR[d.weekday]} ${formatMinuteOfDay(d.minuteOfDay)}`;
}

/** Short label, e.g. "J3 10:03" (used in tables and messages). */
export function formatSimShort(sim: number): string {
  const d = toSimDate(sim);
  const dayLabel = d.dayIndex !== null ? `J${d.dayIndex}` : "Week-end";
  return `${dayLabel} ${formatMinuteOfDay(d.minuteOfDay)}`;
}
