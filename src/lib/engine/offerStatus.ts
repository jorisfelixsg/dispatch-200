// Per-offer status for the tracking screen (E3). Uses R1 (dependencies) and R2 (24h delay).
// The full priority engine (R3–R15) is built in step 3.

import { DELAY_S4_S5, STEPS, type Step } from "./config";
import type { StepExecution } from "./types";

export type StepMap = Partial<Record<Step, StepExecution>>;

/** Index step executions by offer, then by step. */
export function indexExecutions(executions: readonly StepExecution[]): Map<number, StepMap> {
  const byOffer = new Map<number, StepMap>();
  for (const e of executions) {
    const map = byOffer.get(e.offerId) ?? {};
    map[e.step] = e;
    byOffer.set(e.offerId, map);
  }
  return byOffer;
}

/** R1 — dependencies satisfied (ignores the 24h delay). */
export function dependenciesMet(steps: StepMap, step: Step): boolean {
  switch (step) {
    case "S1":
    case "S2":
      return true;
    case "S3":
      return Boolean(steps.S1 && steps.S2);
    case "S4":
      return Boolean(steps.S2);
    case "S5":
      return Boolean(steps.S3 && steps.S4);
  }
}

/** R2 — earliest simulated minute at which S5 may start, or null if S4 is not done. */
export function s5AvailableAt(steps: StepMap): number | null {
  return steps.S4 ? steps.S4.doneAtSim + DELAY_S4_S5 : null;
}

/** R1 + R2 — the step is not done and can be done now. */
export function isStepReady(steps: StepMap, step: Step, nowSim: number): boolean {
  if (steps[step]) return false;
  if (!dependenciesMet(steps, step)) return false;
  if (step === "S5") return nowSim >= (s5AvailableAt(steps) ?? Infinity);
  return true;
}

export function isPublished(steps: StepMap): boolean {
  return Boolean(steps.S5);
}

/** US-08 filter: S3 and S4 done, S5 not done, and the 24h delay not elapsed. */
export function isWaitingFor24h(steps: StepMap, nowSim: number): boolean {
  if (!steps.S3 || !steps.S4 || steps.S5) return false;
  return nowSim < (s5AvailableAt(steps) ?? Infinity);
}

export type OfferPhase = "published" | "waiting24h" | "inProgress" | "notStarted";

export function offerPhase(steps: StepMap, nowSim: number): OfferPhase {
  if (isPublished(steps)) return "published";
  if (isWaitingFor24h(steps, nowSim)) return "waiting24h";
  return STEPS.some((s) => steps[s]) ? "inProgress" : "notStarted";
}
