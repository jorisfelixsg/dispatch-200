// R11 — Catch-up actions: one-click effect, logged, and cancellable.

import { EXTRA_HOUR_MIN, RENFORT_S1_BUDGET, type Step } from "./config";
import type { ControlResult, Level } from "./controls";
import { DEFAULT_PEOPLE, type PersonId } from "./people";
import { currentDay, getPerson } from "./state";
import type { DayAdjustment, Person, WorldState } from "./types";

export type ActionType = "FORCE_ORDER" | "RENFORT_S1" | "TRAIN_BACKUP" | "EXTRA_HOUR" | "RERANK";

/** R11 — actions are always proposed in this order. */
export const ACTION_ORDER: readonly ActionType[] = ["FORCE_ORDER", "RENFORT_S1", "TRAIN_BACKUP", "EXTRA_HOUR", "RERANK"];

export type Action =
  | { type: "FORCE_ORDER"; personId: PersonId; sequence?: Step[] }
  | { type: "RENFORT_S1" }
  | { type: "TRAIN_BACKUP"; personId: PersonId; step: Step }
  | { type: "EXTRA_HOUR"; personId: PersonId; dayIndex: number }
  | { type: "RERANK" };

/** R11 — actions are proposed when the global level is orange or red. */
export function shouldProposeActions(level: Level): boolean {
  return level !== "green";
}

/**
 * R11 — "Personne concernée" = the only competent person of the worst control (lowest margin;
 * on a tie, the first in S2, S3, S4, S5, global order). Null when the control is shared or global:
 * the orchestrator chooses.
 */
export function concernedPerson(controls: readonly ControlResult[]): PersonId | null {
  if (controls.length === 0) return null;
  const worst = controls.reduce((w, c) => (c.margin < w.margin ? c : w));
  if (worst.id === "global" || worst.competent.length !== 1) return null;
  return worst.competent[0];
}

function updatePerson(state: WorldState, id: PersonId, update: (p: Person) => Person): WorldState {
  getPerson(state, id);
  return { ...state, people: state.people.map((p) => (p.id === id ? update(p) : p)) };
}

function addExtra(state: WorldState, personId: PersonId, dayIndex: number, delta: number): WorldState {
  const existing = state.adjustments.find((a) => a.personId === personId && a.dayIndex === dayIndex);
  const next: DayAdjustment = existing
    ? { ...existing, extraMin: Math.max(0, existing.extraMin + delta) }
    : { personId, dayIndex, extraMin: Math.max(0, delta), absentDeclared: false, absentDetected: false };
  return { ...state, adjustments: [...state.adjustments.filter((a) => a !== existing), next] };
}

/** RERANK — A first, then B, then C; id order is kept inside each group. */
function rerank(state: WorldState, byImportance: boolean): WorldState {
  const order = { A: 0, B: 1, C: 2 } as const;
  const sorted = [...state.offers].sort((a, b) => (byImportance ? order[a.importance] - order[b.importance] : 0) || a.id - b.id);
  const rankOf = new Map(sorted.map((o, i) => [o.id, i + 1]));
  return { ...state, offers: state.offers.map((o) => ({ ...o, rank: rankOf.get(o.id)! })) };
}

export function applyAction(state: WorldState, action: Action): WorldState {
  switch (action.type) {
    case "FORCE_ORDER":
      // One task at a time, only in forced_sequence (default = the major step alone).
      return updatePerson(state, action.personId, (p) => ({
        ...p,
        forcedMode: true,
        forcedSequence: action.sequence ?? (p.forcedSequence.length > 0 ? p.forcedSequence : p.majorStep ? [p.majorStep] : []),
      }));
    case "RENFORT_S1":
      // The orchestrator gets S1 and 60 min/day from today.
      return { ...state, renfortS1: { active: true, budgetPerDay: RENFORT_S1_BUDGET, sinceDay: currentDay(state) } };
    case "TRAIN_BACKUP":
      // Adds the step to the skills, in last position of priority_order.
      return updatePerson(state, action.personId, (p) => ({
        ...p,
        skills: p.skills.includes(action.step) ? p.skills : [...p.skills, action.step],
        priorityOrder: p.priorityOrder.includes(action.step) ? p.priorityOrder : [...p.priorityOrder, action.step],
      }));
    case "EXTRA_HOUR":
      return addExtra(state, action.personId, action.dayIndex, EXTRA_HOUR_MIN);
    case "RERANK":
      return rerank(state, true);
  }
}

/** Removes the effect of an applied action. */
export function revertAction(state: WorldState, action: Action): WorldState {
  switch (action.type) {
    case "FORCE_ORDER":
      return updatePerson(state, action.personId, (p) => ({ ...p, forcedMode: false }));
    case "RENFORT_S1":
      return { ...state, renfortS1: { ...state.renfortS1, active: false } };
    case "TRAIN_BACKUP": {
      const defaults = DEFAULT_PEOPLE.find((p) => p.id === action.personId);
      if (defaults?.skills.includes(action.step)) return state;
      return updatePerson(state, action.personId, (p) => ({
        ...p,
        skills: p.skills.filter((s) => s !== action.step),
        priorityOrder: p.priorityOrder.filter((s) => s !== action.step),
        forcedSequence: p.forcedSequence.filter((s) => s !== action.step),
      }));
    }
    case "EXTRA_HOUR":
      return addExtra(state, action.personId, action.dayIndex, -EXTRA_HOUR_MIN);
    case "RERANK":
      // Initial ranks follow the id order.
      return rerank(state, false);
  }
}
