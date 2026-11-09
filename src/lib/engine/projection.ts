// US-17 (COULD) — projection: published offers at J22 over several auto-mode simulations of the
// rest of the month, on a copy of the current state (nothing is written).

import { playUntilDay, publishedCount } from "./autoplay";
import { BUSINESS_DAYS } from "./config";
import type { WorldState } from "./types";

export const PROJECTION_RUNS = 20;

export interface Projection {
  runs: number;
  min: number;
  median: number;
  max: number;
  /** Simulated minute of the state the projection starts from. */
  fromSim: number;
}

export function projectEndOfMonth(state: WorldState, runs = PROJECTION_RUNS): Projection {
  const results: number[] = [];
  for (let seed = 1; seed <= runs; seed++) {
    results.push(publishedCount(playUntilDay(state, BUSINESS_DAYS + 1, seed).state));
  }
  results.sort((a, b) => a - b);
  const mid = Math.floor(results.length / 2);
  const median = results.length % 2 === 1 ? results[mid] : Math.round((results[mid - 1] + results[mid]) / 2);
  return { runs, min: results[0], median, max: results[results.length - 1], fromSim: state.nowSim };
}
