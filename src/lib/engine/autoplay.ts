// R14 — Auto mode and R15 — reference trajectory. Uses exactly the same functions as R1–R12.
//
// PM decisions (2026-11-09): connection times are drawn uniformly between max(08:00, current time)
// and 19:00 minus the person's remaining budget (so a session ends by 19:00; 18:00 for 60 min).
// If that window is empty (late in the day), the person connects at the current time.

import { BUSINESS_DAYS, DAY_END, DAY_START } from "./config";
import { detectAbsences, markAbsencesDetected } from "./absences";
import { consumedOn, dayBudget } from "./budget";
import { isEndOfMonth, nextBusinessDay } from "./clock";
import { completeStep } from "./completion";
import type { PersonId } from "./people";
import { createRng, randomInt, type Rng } from "./random";
import { currentDay, initialWorldState } from "./state";
import { computeTaskList } from "./taskList";
import { simAt, toSimDate } from "./time";
import type { EngineEvent, OfferRef, StepExecution, WorldState } from "./types";

/** Seed of the reference trajectory (R15). */
export const REFERENCE_SEED = 42;

export interface PlannedSession {
  personId: PersonId;
  /** Simulated minute of the connection. */
  connectAt: number;
  /** Budget left when the session starts. */
  remaining: number;
}

export interface AutoResult {
  state: WorldState;
  executions: StepExecution[];
  events: EngineEvent[];
  daysPlayed: number[];
}

/**
 * One generator per (seed, day): playing J1…J9 in one run or day by day gives the same result.
 */
export function dayRng(seed: number, dayIndex: number): Rng {
  return createRng((seed ^ Math.imul(dayIndex, 0x9e3779b1)) >>> 0);
}

/** Draws the connection time of every person with budget left on the current day. */
export function planSessions(state: WorldState, rng: Rng): PlannedSession[] {
  const day = currentDay(state);
  if (day === null) return [];
  const earliest = Math.max(DAY_START, toSimDate(state.nowSim).minuteOfDay);
  const plans: (PlannedSession & { order: number })[] = [];
  state.people.forEach((p, order) => {
    const remaining = dayBudget(state, p.id, day) - consumedOn(state, p.id, day);
    if (remaining <= 0) return; // absent, no budget (orchestrator without reinforcement), or done
    const latest = DAY_END - remaining;
    const minute = latest >= earliest ? randomInt(rng, earliest, latest) : earliest;
    plans.push({ personId: p.id, connectAt: simAt(day, minute), remaining, order });
  });
  return plans
    .sort((a, b) => a.connectAt - b.connectAt || a.order - b.order)
    .map(({ personId, connectAt, remaining }) => ({ personId, connectAt, remaining }));
}

/** Plays one session: take the first task of the list, validate it, recompute, until nothing fits. */
function playSession(state: WorldState, personId: PersonId, doneAtReal: string, out: AutoResult): WorldState {
  let current = state;
  for (;;) {
    const first = computeTaskList(current, personId).tasks[0];
    if (!first) return current;
    const r = completeStep(current, { personId, offerId: first.offerId, step: first.step, source: "auto", doneAtReal });
    if (!r.ok) throw new Error(`Auto mode: unexpected refusal ${r.error.code} for ${personId} ${first.step} #${first.offerId}`);
    out.executions.push(r.execution);
    out.events.push(...r.events);
    current = r.state;
  }
}

/** « Jouer la journée en cours »: the rest of today, then the next business day at 08:00 and R12. */
export function playCurrentDay(state: WorldState, seed: number, doneAtReal = ""): AutoResult {
  const out: AutoResult = { state, executions: [], events: [], daysPlayed: [] };
  const day = currentDay(state);
  if (day === null || isEndOfMonth(state.nowSim)) return out;

  // Reservations only describe what open screens show; they do not apply to the simulation.
  let current: WorldState = { ...state, reservations: [] };
  for (const session of planSessions(current, dayRng(seed, day))) {
    current = { ...current, nowSim: Math.max(current.nowSim, session.connectAt) };
    current = playSession(current, session.personId, doneAtReal, out);
  }

  // End of day: R12 (detected absences), then the next business day at 08:00 (J22 → end of month).
  const endOfDay = Math.max(current.nowSim, simAt(day, DAY_END));
  const absent = day < BUSINESS_DAYS ? detectAbsences(current, day) : [];
  current = markAbsencesDetected(current, absent, day);
  for (const personId of absent) {
    out.events.push({ type: "ABSENCE_DETECTED", personId, payload: { dayIndex: day }, atSim: endOfDay });
  }
  current = { ...current, nowSim: nextBusinessDay(current.nowSim) };

  out.daysPlayed.push(day);
  out.state = current;
  return out;
}

/** « Jouer jusqu'au début de Jx »: plays every day before Jx (J23 = until the end of the month). */
export function playUntilDay(state: WorldState, targetDay: number, seed: number, doneAtReal = ""): AutoResult {
  const out: AutoResult = { state, executions: [], events: [], daysPlayed: [] };
  let current = state;
  while (!isEndOfMonth(current.nowSim) && (currentDay(current) ?? Infinity) < targetDay) {
    const r = playCurrentDay(current, seed, doneAtReal);
    out.executions.push(...r.executions);
    out.events.push(...r.events);
    out.daysPlayed.push(...r.daysPlayed);
    current = r.state;
  }
  out.state = current;
  return out;
}

export function publishedCount(state: WorldState): number {
  return state.executions.filter((e) => e.step === "S5").length;
}

/** R15 — cumulative published offers at the end of J1…J22, auto mode from the initial state. */
export function referenceCurve(offers: readonly OfferRef[], seed = REFERENCE_SEED): number[] {
  let state = initialWorldState(offers);
  const curve: number[] = [];
  for (let day = 1; day <= BUSINESS_DAYS; day++) {
    state = playCurrentDay(state, seed).state;
    curve.push(publishedCount(state));
  }
  return curve;
}
