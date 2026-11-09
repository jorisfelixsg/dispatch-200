// Test helpers: build world states quickly. Not used by the application.

import type { Step } from "../config";
import type { PersonId } from "../people";
import { initialWorldState } from "../state";
import { simAt } from "../time";
import type { Importance, OfferRef, Session, StepExecution, WorldState } from "../types";

/** 200 offers with id = rank. Importances follow the 40 A / 80 B / 80 C split, interleaved. */
export function makeOffers(count = 200): OfferRef[] {
  const pattern: Importance[] = ["A", "B", "C", "B", "C"];
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, rank: i + 1, importance: pattern[i % pattern.length] }));
}

export function initialState(overrides: Partial<WorldState> = {}): WorldState {
  return { ...initialWorldState(makeOffers(), 1_000_000), ...overrides };
}

export function exec(offerId: number, step: Step, doneAtSim: number, doneBy: PersonId = "alice"): StepExecution {
  return { offerId, step, doneBy, doneAtSim, doneAtReal: "", inPriority: true, source: "manual" };
}

/** Executions of `steps` for offers `from..to` (inclusive), one minute apart from `startSim`. */
export function execRange(
  from: number,
  to: number,
  steps: readonly Step[],
  startSim = simAt(1, 480),
  doneBy: PersonId = "alice",
): StepExecution[] {
  const result: StepExecution[] = [];
  let t = startSim;
  for (let id = from; id <= to; id++) for (const s of steps) result.push(exec(id, s, ++t, doneBy));
  return result;
}

export function session(personId: PersonId, dayIndex: number, consumedMin: number, cursorSim = 0): Session {
  return { personId, dayIndex, cursorSim, consumedMin };
}

/** Compact "S2 r1" labels to compare lists with the spec examples. */
export function labels(tasks: readonly { step: Step; rank: number }[]): string[] {
  return tasks.map((t) => `${t.step} r${t.rank}`);
}
