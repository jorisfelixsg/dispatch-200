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

/** Minimal offer data the engine needs (rank changes with the RERANK action). */
export type OfferRef = Pick<Offer, "id" | "rank" | "importance">;

/** Per person and business day: exceptional minutes and absences (R4, R11 action 4, R12). */
export interface DayAdjustment {
  personId: PersonId;
  dayIndex: number;
  extraMin: number;
  absentDeclared: boolean;
  absentDetected: boolean;
}

/** Per person and business day: session cursor (R3) and minutes consumed (R4). */
export interface Session {
  personId: PersonId;
  dayIndex: number;
  cursorSim: number;
  consumedMin: number;
}

/** R7 — a task shown in someone's list. `expiresAtReal` is a real timestamp in ms. */
export interface Reservation {
  personId: PersonId;
  offerId: number;
  step: Step;
  expiresAtReal: number;
}

/** R11 action 2 — external reinforcement on S1, played by the orchestrator. */
export interface RenfortS1 {
  active: boolean;
  budgetPerDay: number;
  /** First business day of the reinforcement. */
  sinceDay: number | null;
}

/** Everything the engine reads. Engine functions never mutate it; they return a new state. */
export interface WorldState {
  nowSim: number;
  /** Real time in ms, only used for reservation expiry (R7). */
  nowReal: number;
  offers: readonly OfferRef[];
  executions: readonly StepExecution[];
  people: readonly Person[];
  adjustments: readonly DayAdjustment[];
  sessions: readonly Session[];
  reservations: readonly Reservation[];
  renfortS1: RenfortS1;
}

export interface Task {
  offerId: number;
  step: Step;
}

export type EngineEventType =
  | "STEP_DONE"
  | "OUT_OF_PRIORITY"
  | "ABSENCE_DECLARED"
  | "ABSENCE_DETECTED"
  | "ACTION_APPLIED"
  | "ACTION_CANCELLED"
  | "CLOCK_CHANGED"
  | "AUTO_RUN"
  | "RESET";

export interface EngineEvent {
  type: EngineEventType;
  personId: PersonId | null;
  payload: Record<string, unknown>;
  atSim: number;
}
