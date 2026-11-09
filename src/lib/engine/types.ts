// Domain types shared by the engine and the UI (camelCase; DB rows are mapped in lib/data).

import type { Step } from "./config";
import type { PersonId, Role } from "./people";

export type Importance = "A" | "B" | "C";

export interface Offer {
  id: number;
  /** Processing order, 1–200. */
  rank: number;
  merchantName: string;
  slug: string;
  importance: Importance;
  category: string;
  description: string;
  url: string;
  imageUrl: string;
  logoUrl: string;
}

export interface StepExecution {
  offerId: number;
  step: Step;
  doneBy: PersonId;
  /** End time of the step, in simulated minutes (R3). */
  doneAtSim: number;
  doneAtReal: string;
  inPriority: boolean;
  source: "manual" | "auto";
}

export interface Person {
  id: PersonId;
  name: string;
  role: Role;
  skills: Step[];
  majorStep: Step | null;
  priorityOrder: Step[];
  forcedMode: boolean;
  forcedSequence: Step[];
  dailyBudgetMin: number;
}
