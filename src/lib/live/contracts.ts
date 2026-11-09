// Request / response shapes shared by the API routes and the browser.

import type { Step } from "@/lib/engine/config";
import type { PersonId } from "@/lib/engine/people";
import type { EmptyReason } from "@/lib/engine/taskList";
import type { ControlResult, Level } from "@/lib/engine/controls";
import type { ActionProposal, ActionType } from "@/lib/engine/actions";
import type { Indicators } from "@/lib/engine/indicators";
import type { Projection } from "@/lib/engine/projection";

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
  /** Business days for which this person declared an absence (R12). */
  absences: number[];
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

export interface ControlPayload {
  nowSim: number;
  level: Level;
  controls: ControlResult[];
  indicators: Indicators;
  actualCurve: number[];
  referenceCurve: number[] | null;
  /** R11 — proposals (empty when the global level is green). */
  proposals: ActionProposal[];
  /** Applied actions that are not cancelled, oldest first. */
  activeActions: ActiveAction[];
  renfortActive: boolean;
  forcedPeople: PersonId[];
  today: number | null;
  /** Declared absences (R12), so the tower does not offer an extra hour on those days. */
  declaredAbsences: { personId: PersonId; dayIndex: number }[];
}

export interface ActiveAction {
  id: number;
  type: ActionType;
  params: { personId?: PersonId; dayIndex?: number; sinceDay?: number | null; sequence?: Step[] };
  appliedAtSim: number;
}

export type ControlResponse = { ok: true; payload: ControlPayload } | { ok: false; error: string };

export type AbsenceResponse = { ok: true; payload: TasksPayload } | { ok: false; error: string; code?: string };

export type ActionsResponse = { ok: true; id: number } | { ok: false; error: string; code?: string };

/** US-18 — impact of a catch-up action before applying it: every control whose margin changes. */
export interface ActionPreview {
  changes: { controlId: ControlResult["id"]; marginBefore: number; marginAfter: number }[];
  levelBefore: Level;
  levelAfter: Level;
}

export type PreviewResponse = { ok: true; preview: ActionPreview } | { ok: false; error: string; code?: string };

export type ProjectionResponse = { ok: true; projection: Projection } | { ok: false; error: string };
