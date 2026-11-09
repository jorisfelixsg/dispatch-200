// R5 — Order of the "Mes tâches" list, with R4 (budget), R7 (reservations) and R11 action 1 (forced mode).

import { DELAY_S4_S5, RESERVATION_TTL_MS, STEPS, type Step } from "./config";
import { budgetStatus } from "./budget";
import { indexExecutions, isStepReady, type StepMap } from "./offerStatus";
import type { PersonId } from "./people";
import { currentDay, duration, effectivePerson, offersByRank } from "./state";
import type { OfferRef, Person, Reservation, Task, WorldState } from "./types";

/** Alice walks merchants by rank: S2, then S1 of the same merchant (R5 special case). */
export const PAIRED_S2_S1_PERSON: PersonId = "alice";

export interface ListedTask extends Task {
  rank: number;
  duration: number;
  /** True when the step is the person's major step ("majeure"), false otherwise ("secondaire"). */
  major: boolean;
}

export type EmptyReason = "absent" | "noSkills" | "budgetExhausted" | "nothingReady" | "nothingFits";

export interface TaskListResult {
  personId: PersonId;
  tasks: ListedTask[];
  budget: number;
  consumed: number;
  remaining: number;
  /** Why the list is empty, or null when it is not. */
  emptyReason: EmptyReason | null;
}

export function taskKey(t: Task): string {
  return `${t.offerId}:${t.step}`;
}

export function isReservationActive(r: Reservation, nowReal: number): boolean {
  return r.expiresAtReal > nowReal;
}

interface Context {
  offers: OfferRef[];
  steps: Map<number, StepMap>;
  reservedByOthers: Set<string>;
}

function buildContext(state: WorldState, personId: PersonId): Context {
  const reservedByOthers = new Set<string>();
  for (const r of state.reservations) {
    if (r.personId !== personId && isReservationActive(r, state.nowReal)) reservedByOthers.add(taskKey(r));
  }
  return { offers: offersByRank(state.offers), steps: indexExecutions(state.executions), reservedByOthers };
}

/** R5 filter: in the person's skills, ready (R1, R2), not reserved by another active person (R7). */
function canList(ctx: Context, person: Person, offer: OfferRef, step: Step, nowSim: number): boolean {
  if (!person.skills.includes(step)) return false;
  if (!isStepReady(ctx.steps.get(offer.id) ?? {}, step, nowSim)) return false;
  return !ctx.reservedByOthers.has(`${offer.id}:${step}`);
}

/** R5 seniority within a step (smaller first). Ties are broken by rank. */
function seniority(steps: StepMap, step: Step, rank: number): number {
  switch (step) {
    case "S4":
      return steps.S2?.doneAtSim ?? Infinity;
    case "S3":
      return Math.max(steps.S1?.doneAtSim ?? Infinity, steps.S2?.doneAtSim ?? Infinity);
    case "S5":
      // Unlock time = the moment the step became ready (R1 + R2).
      return Math.max(steps.S3?.doneAtSim ?? Infinity, (steps.S4?.doneAtSim ?? Infinity) + DELAY_S4_S5);
    case "S1":
    case "S2":
      return rank;
  }
}

/** Ready tasks of one step, sorted by seniority then rank. */
function readyTasksOfStep(ctx: Context, person: Person, step: Step, nowSim: number): OfferRef[] {
  return ctx.offers
    .filter((o) => canList(ctx, person, o, step, nowSim))
    .map((o) => ({ o, key: seniority(ctx.steps.get(o.id) ?? {}, step, o.rank) }))
    .sort((a, b) => a.key - b.key || a.o.rank - b.o.rank)
    .map(({ o }) => o);
}

/** Steps in priority order, then any skill missing from the priority order. */
function orderedSteps(person: Person): Step[] {
  const ordered = person.priorityOrder.filter((s) => person.skills.includes(s));
  for (const s of STEPS) if (person.skills.includes(s) && !ordered.includes(s)) ordered.push(s);
  return ordered;
}

function toTask(person: Person, offer: OfferRef, step: Step): ListedTask {
  return { offerId: offer.id, step, rank: offer.rank, duration: duration(step), major: person.majorStep === step };
}

/** All listable tasks of a person, in R5 order, before the budget cut. */
function orderedCandidates(ctx: Context, person: Person, nowSim: number): ListedTask[] {
  const result: ListedTask[] = [];
  let steps = orderedSteps(person);

  if (person.id === PAIRED_S2_S1_PERSON && steps.includes("S2")) {
    // R5 special case: Alice walks merchants by rank: S2, then S1 of the same merchant if S1 is
    // neither done nor reserved. Once every S2 is done: the remaining S1 by rank.
    // PM decision (2026-11-09): a merchant stays in the walk until both S2 and S1 are done, so the
    // S1 is still offered right after its S2 was validated (the literal "without S2" reading dropped
    // it and made the 50-seed reference test fail).
    const walk = ctx.offers.filter((o) => !ctx.steps.get(o.id)?.S2 || !ctx.steps.get(o.id)?.S1);
    if (ctx.offers.some((o) => !ctx.steps.get(o.id)?.S2)) {
      for (const o of walk) {
        if (canList(ctx, person, o, "S2", nowSim)) result.push(toTask(person, o, "S2"));
        if (canList(ctx, person, o, "S1", nowSim)) result.push(toTask(person, o, "S1"));
      }
    } else {
      for (const o of ctx.offers) if (canList(ctx, person, o, "S1", nowSim)) result.push(toTask(person, o, "S1"));
    }
    steps = steps.filter((s) => s !== "S1" && s !== "S2");
  }

  for (const step of steps) {
    for (const o of readyTasksOfStep(ctx, person, step, nowSim)) result.push(toTask(person, o, step));
  }
  return result;
}

/** R4 + R5 — add tasks in order while the total fits; a task that is too long is skipped. */
function fillBudget(candidates: ListedTask[], remaining: number): ListedTask[] {
  const picked: ListedTask[] = [];
  let total = 0;
  for (const t of candidates) {
    if (total + t.duration <= remaining) {
      picked.push(t);
      total += t.duration;
    }
  }
  return picked;
}

/**
 * R11 action 1 — forced mode: one task at a time, only from forced_sequence. The next step of the
 * sequence is offered only when no task of the previous step is ready.
 */
function forcedPick(ctx: Context, person: Person, nowSim: number, remaining: number): ListedTask[] {
  for (const step of person.forcedSequence) {
    const ready = readyTasksOfStep(ctx, person, step, nowSim);
    if (ready.length === 0) continue;
    const first = toTask(person, ready[0], step);
    return first.duration <= remaining ? [first] : [];
  }
  return [];
}

/** The "Mes tâches" list of a person at the current simulated time. */
export function computeTaskList(state: WorldState, personId: PersonId): TaskListResult {
  const day = currentDay(state) ?? 0;
  const person = effectivePerson(state, personId, day);
  const budget = budgetStatus(state, personId);
  const ctx = buildContext(state, personId);
  const candidates = orderedCandidates(ctx, person, state.nowSim);
  const tasks = person.forcedMode
    ? forcedPick(ctx, person, state.nowSim, budget.remaining)
    : fillBudget(candidates, budget.remaining);

  let emptyReason: EmptyReason | null = null;
  if (tasks.length === 0) {
    if (budget.absentDeclared) emptyReason = "absent";
    else if (person.skills.length === 0) emptyReason = "noSkills";
    else if (budget.remaining === 0) emptyReason = "budgetExhausted";
    else if (candidates.length === 0) emptyReason = "nothingReady";
    else emptyReason = "nothingFits";
  }
  return { personId, tasks, budget: budget.budget, consumed: budget.consumed, remaining: budget.remaining, emptyReason };
}

/** R7 — replace the person's reservations by the tasks of their list. Expired ones are dropped. */
export function replaceReservations(state: WorldState, personId: PersonId, tasks: readonly Task[]): WorldState {
  const kept = state.reservations.filter((r) => r.personId !== personId && isReservationActive(r, state.nowReal));
  const expiresAtReal = state.nowReal + RESERVATION_TTL_MS;
  return {
    ...state,
    reservations: [...kept, ...tasks.map((t) => ({ personId, offerId: t.offerId, step: t.step, expiresAtReal }))],
  };
}

/** R6 + R7 — compute a person's list and reserve its tasks. */
export function refreshTaskList(state: WorldState, personId: PersonId): { list: TaskListResult; state: WorldState } {
  const list = computeTaskList(state, personId);
  return { list, state: replaceReservations(state, personId, list.tasks) };
}

/** R6 — recompute the lists of every connected person, one after another (reservations chain). */
export function refreshAllTaskLists(
  state: WorldState,
  personIds: readonly PersonId[],
): { lists: TaskListResult[]; state: WorldState } {
  let current = state;
  const lists: TaskListResult[] = [];
  for (const id of personIds) {
    const r = refreshTaskList(current, id);
    lists.push(r.list);
    current = r.state;
  }
  return { lists, state: current };
}
