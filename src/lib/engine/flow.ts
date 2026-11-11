// Tower v2 (PM 2026-11-11) — facts shown on the control tower that the engine already knows but did
// not expose: offers waiting in front of each step (R1, R2), who can do each step today, and how
// each person's day is going (R4, R12). No new business rule here.

import { STEPS, type Step } from "./config";
import { adjustmentFor, consumedOn, dayBudget } from "./budget";
import { indexExecutions, isStepReady, isWaitingFor24h } from "./offerStatus";
import type { PersonId } from "./people";
import { currentDay, effectivePerson } from "./state";
import type { WorldState } from "./types";

export interface FlowFacts {
  /** Offers whose step is not done and can be done now (R1 + R2). */
  ready: Record<Step, number>;
  /** Offers with S3 and S4 done whose 24h delay before S5 is not over yet (R2). */
  waiting24h: number;
  /** People who can do each step today (skills, including the S1 reinforcement). */
  skilled: Record<Step, PersonId[]>;
}

export function computeFlow(state: WorldState): FlowFacts {
  const byOffer = indexExecutions(state.executions);
  const ready = Object.fromEntries(STEPS.map((s) => [s, 0])) as Record<Step, number>;
  let waiting24h = 0;
  for (const offer of state.offers) {
    const steps = byOffer.get(offer.id) ?? {};
    for (const s of STEPS) if (isStepReady(steps, s, state.nowSim)) ready[s] += 1;
    if (isWaitingFor24h(steps, state.nowSim)) waiting24h += 1;
  }
  const day = currentDay(state) ?? 0;
  const skilled = Object.fromEntries(
    STEPS.map((s) => [s, state.people.filter((p) => effectivePerson(state, p.id, day).skills.includes(s)).map((p) => p.id)]),
  ) as Record<Step, PersonId[]>;
  return { ready, waiting24h, skilled };
}

export interface TeamMember {
  personId: PersonId;
  /** Budget of today (0 when absent), consumed minutes today. */
  budget: number;
  consumed: number;
  absentToday: boolean;
  /** End time of the last step the person did (any day), or null. */
  lastDoneSim: number | null;
  /** Business days with a declared or detected absence, sorted. */
  absentDays: number[];
}

/** People with a budget today or on any day (contributors, and the orchestrator once the S1 reinforcement is on). */
export function computeTeam(state: WorldState): TeamMember[] {
  const today = currentDay(state);
  return state.people
    .filter((p) => p.role === "contributor" || (p.id === "orchestrator" && state.renfortS1.active))
    .map((p) => {
      const last = state.executions.filter((e) => e.doneBy === p.id).reduce<number | null>((m, e) => (m === null || e.doneAtSim > m ? e.doneAtSim : m), null);
      const absentDays = state.adjustments
        .filter((a) => a.personId === p.id && (a.absentDeclared || a.absentDetected))
        .map((a) => a.dayIndex)
        .sort((a, b) => a - b);
      return {
        personId: p.id,
        budget: today === null ? 0 : dayBudget(state, p.id, today),
        consumed: today === null ? 0 : consumedOn(state, p.id, today),
        absentToday: today !== null && Boolean(adjustmentFor(state, p.id, today)?.absentDeclared),
        lastDoneSim: last,
        absentDays,
      };
    });
}
