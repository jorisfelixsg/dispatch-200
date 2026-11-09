// Request / response shapes shared by the API routes and the browser.

import type { Step } from "@/lib/engine/config";
import type { PersonId } from "@/lib/engine/people";
import type { EmptyReason } from "@/lib/engine/taskList";

export interface TaskView {
  offerId: number;
  step: Step;
  rank: number;
  duration: number;
  major: boolean;
  merchantName: string;
  category: string;
  logoUrl: string;
}

export interface TasksPayload {
  personId: PersonId;
  nowSim: number;
  dayIndex: number | null;
  autoRunning: boolean;
  tasks: TaskView[];
  budget: number;
  consumed: number;
  remaining: number;
  emptyReason: EmptyReason | null;
}

export type TasksResponse = { ok: true; payload: TasksPayload } | { ok: false; error: string };

export type DoneResponse =
  | { ok: true; doneAtSim: number; payload: TasksPayload }
  | { ok: false; error: string; code: string; payload?: TasksPayload };

export type ClockAction = "plus1h" | "plus2h" | "nextDay" | "goToDay";

export type ClockResponse = { ok: true; nowSim: number; changed: boolean } | { ok: false; error: string };

export type AutoResponse =
  | {
      ok: true;
      seed: number;
      daysPlayed: number[];
      steps: number;
      published: number;
      /** Simulated minute of the last S5, or null if nothing is published yet. */
      lastPublication: number | null;
      nowSim: number;
      durationMs: number;
    }
  | { ok: false; error: string; code?: string };
