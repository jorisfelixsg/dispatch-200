// Small read helpers over the world state.

import { DURATIONS, type Step } from "./config";
import { DEFAULT_PEOPLE, type PersonDefaults, type PersonId } from "./people";
import { SIM_START, toSimDate } from "./time";
import type { OfferRef, Person, RenfortS1, WorldState } from "./types";

/** Business day of the shared clock, or null on a weekend (never happens with R13). */
export function currentDay(state: Pick<WorldState, "nowSim">): number | null {
  return toSimDate(state.nowSim).dayIndex;
}

export function duration(step: Step): number {
  return DURATIONS[step];
}

export function getPerson(state: WorldState, id: PersonId): Person {
  const person = state.people.find((p) => p.id === id);
  if (!person) throw new Error(`Unknown person: ${id}`);
  return person;
}

/** Person state as restored by a reset. */
export function personFromDefaults(p: PersonDefaults): Person {
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    skills: [...p.skills],
    majorStep: p.majorStep,
    priorityOrder: [...p.priorityOrder],
    forcedMode: false,
    forcedSequence: p.majorStep ? [p.majorStep] : [],
    dailyBudgetMin: p.dailyBudgetMin,
  };
}

export function renfortActiveOn(renfort: RenfortS1, dayIndex: number): boolean {
  return renfort.active && renfort.sinceDay !== null && dayIndex >= renfort.sinceDay;
}

/**
 * Person as seen by the engine on a given day. When "Renfort S1" is active (R11 action 2),
 * the orchestrator gets the S1 skill and the reinforcement's daily budget.
 */
export function effectivePerson(state: WorldState, id: PersonId, dayIndex: number): Person {
  const person = getPerson(state, id);
  if (person.role !== "orchestrator" || !renfortActiveOn(state.renfortS1, dayIndex)) return person;
  return {
    ...person,
    skills: person.skills.includes("S1") ? person.skills : [...person.skills, "S1"],
    priorityOrder: person.priorityOrder.includes("S1") ? person.priorityOrder : [...person.priorityOrder, "S1"],
    dailyBudgetMin: state.renfortS1.budgetPerDay,
  };
}

/** Offers sorted by rank (processing order). */
export function offersByRank(offers: readonly OfferRef[]): OfferRef[] {
  return [...offers].sort((a, b) => a.rank - b.rank);
}

/** Initial world state (what a reset produces), for the engine and its tests. */
export function initialWorldState(offers: readonly OfferRef[], nowReal = 0): WorldState {
  return {
    nowSim: SIM_START,
    nowReal,
    offers: offers.map((o) => ({ id: o.id, rank: o.id, importance: o.importance })),
    executions: [],
    people: DEFAULT_PEOPLE.map(personFromDefaults),
    adjustments: [],
    sessions: [],
    reservations: [],
    renfortS1: { active: false, budgetPerDay: 0, sinceDay: null },
  };
}
