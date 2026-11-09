// "Fait" click: R3 (session cursor), R4 (consumption), R7 (no duplicate), R8 (out of priority).
// The database enforces the same uniqueness atomically (step 4); this pure version is used by
// the server checks and by the auto mode (R14) on an in-memory copy.

import type { Step } from "./config";
import { indexExecutions, isStepReady } from "./offerStatus";
import type { PersonId } from "./people";
import { stampCompletion } from "./session";
import { currentDay, duration, effectivePerson } from "./state";
import { taskKey } from "./taskList";
import type { EngineEvent, Session, StepExecution, WorldState } from "./types";

export interface CompleteInput {
  personId: PersonId;
  offerId: number;
  step: Step;
  source: "manual" | "auto";
  /** False when validated from "Autres tâches possibles" (R8). */
  inPriority: boolean;
  /** ISO timestamp of the click. */
  doneAtReal: string;
}

export type CompleteError =
  | { code: "already_done"; doneBy: PersonId }
  | { code: "unknown_offer" }
  | { code: "not_skilled" }
  | { code: "not_ready" }
  | { code: "not_business_day" };

export type CompleteResult =
  | { ok: true; state: WorldState; execution: StepExecution; events: EngineEvent[] }
  | { ok: false; error: CompleteError };

export function completeStep(state: WorldState, input: CompleteInput): CompleteResult {
  const { personId, offerId, step } = input;
  if (!state.offers.some((o) => o.id === offerId)) return { ok: false, error: { code: "unknown_offer" } };

  // R7 — the step can only be done once ("Déjà faite par X").
  const existing = state.executions.find((e) => e.offerId === offerId && e.step === step);
  if (existing) return { ok: false, error: { code: "already_done", doneBy: existing.doneBy } };

  const dayIndex = currentDay(state);
  if (dayIndex === null) return { ok: false, error: { code: "not_business_day" } };
  if (!effectivePerson(state, personId, dayIndex).skills.includes(step)) {
    return { ok: false, error: { code: "not_skilled" } };
  }
  const steps = indexExecutions(state.executions).get(offerId) ?? {};
  if (!isStepReady(steps, step, state.nowSim)) return { ok: false, error: { code: "not_ready" } };

  // R3 — end time from the personal cursor; R4 — the day is the day of now_sim at click time.
  const minutes = duration(step);
  const session = state.sessions.find((s) => s.personId === personId && s.dayIndex === dayIndex);
  const stamp = stampCompletion(session, state.nowSim, minutes);
  const nextSession: Session = {
    personId,
    dayIndex,
    cursorSim: stamp.cursorSim,
    consumedMin: (session?.consumedMin ?? 0) + minutes,
  };

  const execution: StepExecution = {
    offerId,
    step,
    doneBy: personId,
    doneAtSim: stamp.doneAtSim,
    doneAtReal: input.doneAtReal,
    inPriority: input.inPriority,
    source: input.source,
  };

  const key = taskKey({ offerId, step });
  const events: EngineEvent[] = [
    { type: "STEP_DONE", personId, payload: { offerId, step, source: input.source }, atSim: stamp.doneAtSim },
  ];
  // R8 — a step validated from "Autres tâches possibles" is logged as an incident.
  if (!input.inPriority) {
    events.push({ type: "OUT_OF_PRIORITY", personId, payload: { offerId, step }, atSim: stamp.doneAtSim });
  }

  return {
    ok: true,
    execution,
    events,
    state: {
      ...state,
      executions: [...state.executions, execution],
      sessions: [...state.sessions.filter((s) => s !== session), nextSession],
      reservations: state.reservations.filter((r) => taskKey(r) !== key),
    },
  };
}
