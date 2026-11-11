// R11 — Catch-up actions: one-click effect, logged, and cancellable.
// Action 3 « Former un remplaçant » was removed by the PM (2026-11-09).

import { BUSINESS_DAYS, EXTRA_HOUR_MIN, RENFORT_S1_BUDGET, type Step } from "./config";
import type { ControlResult, Level } from "./controls";
import type { PersonId } from "./people";
import { currentDay, getPerson } from "./state";
import type { DayAdjustment, Person, WorldState } from "./types";

export type ActionType = "FORCE_ORDER" | "RENFORT_S1" | "EXTRA_HOUR" | "RERANK";

/**
 * R11 — actions are always proposed in this order. « Forcer l'ordre » and « Prioriser les marchands
 * importants » are no longer proposed (PM, 2026-11-11); the engine still knows them so that actions
 * applied before can be cancelled (the database is shared with older versions).
 */
export const ACTION_ORDER: readonly ActionType[] = ["RENFORT_S1", "EXTRA_HOUR"];

export type Action =
  | { type: "FORCE_ORDER"; personId: PersonId; sequence?: Step[] }
  | { type: "RENFORT_S1" }
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
    case "EXTRA_HOUR":
      return addExtra(state, action.personId, action.dayIndex, -EXTRA_HOUR_MIN);
    case "RERANK":
      // Initial ranks follow the id order.
      return rerank(state, false);
  }
}

export interface ActionProposal {
  type: ActionType;
  /** Pre-filled person ("personne concernée"), or null when the orchestrator must choose. */
  personId: PersonId | null;
  /** Pre-filled day (EXTRA_HOUR: today, or the next day the person is not declared absent). */
  dayIndex: number | null;
}

function isDeclaredAbsent(state: WorldState, personId: PersonId, dayIndex: number): boolean {
  return state.adjustments.some((a) => a.personId === personId && a.dayIndex === dayIndex && a.absentDeclared);
}

/** First business day from `from` on which the person is not declared absent, or null. */
function firstPresentDay(state: WorldState, personId: PersonId | null, from: number | null): number | null {
  if (from === null) return null;
  if (personId === null) return from;
  for (let d = from; d <= BUSINESS_DAYS; d++) if (!isDeclaredAbsent(state, personId, d)) return d;
  return null;
}

/** R11 — proposals shown when the global level is orange or red, always in ACTION_ORDER. */
export function proposeActions(state: WorldState, controls: readonly ControlResult[], level: Level): ActionProposal[] {
  if (!shouldProposeActions(level)) return [];
  const person = concernedPerson(controls);
  const today = currentDay(state);
  return ACTION_ORDER.map((type) => ({
    type,
    personId: type === "FORCE_ORDER" || type === "EXTRA_HOUR" ? person : null,
    dayIndex: type === "EXTRA_HOUR" ? firstPresentDay(state, person, today) : null,
  }));
}

export type ActionRefusal =
  | "unknown_person"
  | "not_contributor"
  | "already_forced"
  | "already_active"
  | "already_ranked"
  | "past_day"
  | "absent_that_day";

function isImportanceOrder(state: WorldState): boolean {
  const order = { A: 0, B: 1, C: 2 } as const;
  const byRank = [...state.offers].sort((a, b) => a.rank - b.rank);
  return byRank.every((o, i) => i === 0 || order[byRank[i - 1].importance] < order[o.importance] || (order[byRank[i - 1].importance] === order[o.importance] && byRank[i - 1].id < o.id));
}

/** Checks that an action can be applied now (one-click guards, no business rule beyond R11). */
export function checkAction(state: WorldState, action: Action): ActionRefusal | null {
  if ("personId" in action) {
    const person = state.people.find((p) => p.id === action.personId);
    if (!person) return "unknown_person";
    if (person.role !== "contributor") return "not_contributor";
    if (action.type === "FORCE_ORDER" && person.forcedMode) return "already_forced";
  }
  switch (action.type) {
    case "RENFORT_S1":
      return state.renfortS1.active ? "already_active" : null;
    case "EXTRA_HOUR": {
      const today = currentDay(state);
      if (today === null || action.dayIndex < today) return "past_day";
      // PM decision (2026-11-09): no extra hour on a day the person is declared absent.
      return isDeclaredAbsent(state, action.personId, action.dayIndex) ? "absent_that_day" : null;
    }
    case "RERANK":
      return isImportanceOrder(state) ? "already_ranked" : null;
    default:
      return null;
  }
}
