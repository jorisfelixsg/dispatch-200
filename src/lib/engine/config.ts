// Single source of configuration constants (spec section 5).
// These are NOT editable from the UI.

export type Step = "S1" | "S2" | "S3" | "S4" | "S5";

export const STEPS: readonly Step[] = ["S1", "S2", "S3", "S4", "S5"] as const;

/** Theoretical duration of each step, in minutes. */
export const DURATIONS: Readonly<Record<Step, number>> = {
  S1: 3,
  S2: 3,
  S3: 6,
  S4: 3,
  S5: 3,
};

export const OFFER_COUNT = 200;
export const BUSINESS_DAYS = 22;

/** Minutes after midnight. */
export const DAY_START = 8 * 60; // 08:00
export const DAY_END = 19 * 60; // 19:00

export const MINUTES_PER_DAY = 1440;
export const DAYS_PER_WEEK = 7;
export const BUSINESS_DAYS_PER_WEEK = 5;

/** Technical delay between S4 and S5, in minutes (24h, weekends count). */
export const DELAY_S4_S5 = 1440;

export const DAILY_BUDGET = 60;
