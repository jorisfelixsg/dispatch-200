// Default people (spec section 5). Restored on every reset.

import { DAILY_BUDGET, type Step } from "./config";

export type PersonId = "alice" | "bob" | "charlie" | "orchestrator";
export type Role = "contributor" | "orchestrator";

export interface PersonDefaults {
  id: PersonId;
  name: string;
  role: Role;
  skills: Step[];
  majorStep: Step | null;
  /** Ordered steps. Alice's "S2 then S1 of the same merchant" rule is handled by the engine. */
  priorityOrder: Step[];
  dailyBudgetMin: number;
}

export const DEFAULT_PEOPLE: readonly PersonDefaults[] = [
  {
    id: "alice",
    name: "Alice",
    role: "contributor",
    skills: ["S1", "S2"],
    majorStep: "S2",
    priorityOrder: ["S2", "S1"],
    dailyBudgetMin: DAILY_BUDGET,
  },
  {
    id: "bob",
    name: "Bob",
    role: "contributor",
    skills: ["S1", "S4", "S5"],
    majorStep: "S4",
    priorityOrder: ["S4", "S5", "S1"],
    dailyBudgetMin: DAILY_BUDGET,
  },
  {
    id: "charlie",
    name: "Charlie",
    role: "contributor",
    skills: ["S1", "S3", "S5"],
    majorStep: "S3",
    priorityOrder: ["S3", "S5", "S1"],
    dailyBudgetMin: DAILY_BUDGET,
  },
  {
    id: "orchestrator",
    name: "Orchestrateur",
    role: "orchestrator",
    skills: [],
    majorStep: null,
    priorityOrder: [],
    dailyBudgetMin: 0,
  },
] as const;

export const PERSON_IDS: readonly PersonId[] = DEFAULT_PEOPLE.map((p) => p.id);

export function isPersonId(value: unknown): value is PersonId {
  return typeof value === "string" && (PERSON_IDS as readonly string[]).includes(value);
}

export function getDefaultPerson(id: PersonId): PersonDefaults {
  const person = DEFAULT_PEOPLE.find((p) => p.id === id);
  if (!person) throw new Error(`Unknown person: ${id}`);
  return person;
}
