import "server-only";

// Loads the whole world state from Supabase (service key) for the engine, and persists
// a person's reservations (R7).

import type { SupabaseClient } from "@supabase/supabase-js";
import { RESERVATION_TTL_MS, type Step } from "@/lib/engine/config";
import type { PersonId } from "@/lib/engine/people";
import { currentDay } from "@/lib/engine/state";
import { computeTaskList, taskKey, type TaskListResult } from "@/lib/engine/taskList";
import type { WorldState } from "@/lib/engine/types";
import type { TasksPayload } from "@/lib/live/contracts";
import {
  adjustmentFromRow,
  executionFromRow,
  personFromRow,
  renfortFromRow,
  reservationFromRow,
  sessionFromRow,
  type DayAdjustmentRow,
  type PersonRow,
  type ReservationRow,
  type SessionRow,
  type SimStateRow,
  type StepExecutionRow,
} from "./rows";

interface OfferInfo {
  merchantName: string;
  category: string;
  logoUrl: string;
}

export interface LoadedWorld {
  state: WorldState;
  autoRunning: boolean;
  offerInfo: Map<number, OfferInfo>;
}

export class NotSeededError extends Error {
  constructor() {
    super("La démo n'est pas initialisée : l'orchestrateur doit cliquer sur « Réinitialiser la démo ».");
  }
}

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Lecture ${what} impossible : ${res.error.message}`);
  return res.data as T;
}

export async function loadWorld(supabase: SupabaseClient): Promise<LoadedWorld> {
  const [offers, executions, people, adjustments, sessions, reservations, sim] = await Promise.all([
    supabase.from("offer").select("id, rank, importance, merchant_name, category, logo_url").order("rank"),
    supabase.from("step_execution").select("offer_id, step, done_by, done_at_sim, done_at_real, in_priority, source"),
    supabase.from("person").select("*").order("sort_order"),
    supabase.from("day_adjustment").select("person_id, day_index, extra_min, absent_declared, absent_detected"),
    supabase.from("session").select("person_id, day_index, cursor_sim, consumed_min"),
    supabase.from("reservation").select("person_id, offer_id, step, expires_at_real"),
    supabase.from("sim_state").select("now_sim, auto_running, renfort_s1").eq("id", 1).maybeSingle(),
  ]);

  const simRow = check(sim, "de l'horloge") as Pick<SimStateRow, "now_sim" | "auto_running" | "renfort_s1"> | null;
  if (!simRow) throw new NotSeededError();
  const offerRows = check(offers, "des offres") as {
    id: number;
    rank: number;
    importance: "A" | "B" | "C";
    merchant_name: string;
    category: string;
    logo_url: string;
  }[];

  return {
    autoRunning: simRow.auto_running,
    offerInfo: new Map(offerRows.map((o) => [o.id, { merchantName: o.merchant_name, category: o.category, logoUrl: o.logo_url }])),
    state: {
      nowSim: simRow.now_sim,
      nowReal: Date.now(),
      offers: offerRows.map((o) => ({ id: o.id, rank: o.rank, importance: o.importance })),
      executions: (check(executions, "des étapes") as StepExecutionRow[]).map(executionFromRow),
      people: (check(people, "des personnes") as PersonRow[]).map(personFromRow),
      adjustments: (check(adjustments, "des ajustements") as DayAdjustmentRow[]).map(adjustmentFromRow),
      sessions: (check(sessions, "des sessions") as SessionRow[]).map(sessionFromRow),
      reservations: (check(reservations, "des réservations") as ReservationRow[]).map(reservationFromRow),
      renfortS1: renfortFromRow(simRow.renfort_s1),
    },
  };
}

/**
 * Small world slice for checking one « Fait » click (offer, its steps, people, clock): enough for
 * the engine checks (already done, skill, readiness) and much faster than the full world.
 */
export async function loadOfferSlice(supabase: SupabaseClient, offerId: number): Promise<LoadedWorld> {
  const [offers, executions, people, sim] = await Promise.all([
    supabase.from("offer").select("id, rank, importance").eq("id", offerId),
    supabase.from("step_execution").select("offer_id, step, done_by, done_at_sim, done_at_real, in_priority, source").eq("offer_id", offerId),
    supabase.from("person").select("*").order("sort_order"),
    supabase.from("sim_state").select("now_sim, auto_running, renfort_s1").eq("id", 1).maybeSingle(),
  ]);
  const simRow = check(sim, "de l'horloge") as Pick<SimStateRow, "now_sim" | "auto_running" | "renfort_s1"> | null;
  if (!simRow) throw new NotSeededError();
  return {
    autoRunning: simRow.auto_running,
    offerInfo: new Map(),
    state: {
      nowSim: simRow.now_sim,
      nowReal: Date.now(),
      offers: check(offers, "de l'offre") as { id: number; rank: number; importance: "A" | "B" | "C" }[],
      executions: (check(executions, "des étapes") as StepExecutionRow[]).map(executionFromRow),
      people: (check(people, "des personnes") as PersonRow[]).map(personFromRow),
      adjustments: [],
      sessions: [],
      reservations: [],
      renfortS1: renfortFromRow(simRow.renfort_s1),
    },
  };
}

export function toPayload(world: LoadedWorld, list: TaskListResult): TasksPayload {
  return {
    personId: list.personId,
    nowSim: world.state.nowSim,
    dayIndex: currentDay(world.state),
    autoRunning: world.autoRunning,
    tasks: list.tasks.map((t) => {
      const info = world.offerInfo.get(t.offerId);
      return {
        offerId: t.offerId,
        step: t.step,
        rank: t.rank,
        duration: t.duration,
        major: t.major,
        merchantName: info?.merchantName ?? `Offre ${t.offerId}`,
        category: info?.category ?? "",
        logoUrl: info?.logoUrl ?? "",
      };
    }),
    budget: list.budget,
    consumed: list.consumed,
    remaining: list.remaining,
    emptyReason: list.emptyReason,
  };
}

const MAX_ATTEMPTS = 3;

/**
 * R5 + R7 — compute the person's list and reserve its tasks. If another person reserved one of
 * them at the same moment, reload and recompute (the other reservation is then excluded).
 */
export async function computeAndReserve(supabase: SupabaseClient, personId: PersonId): Promise<TasksPayload> {
  for (let attempt = 1; ; attempt++) {
    const world = await loadWorld(supabase);
    const list = computeTaskList(world.state, personId);
    const { data, error } = await supabase.rpc("replace_reservations", {
      p_person: personId,
      p_tasks: list.tasks.map((t) => ({ offer_id: t.offerId, step: t.step })),
      p_ttl_ms: RESERVATION_TTL_MS,
    });
    if (error) throw new Error(`Réservation impossible : ${error.message}`);
    const conflicts = new Set(((data ?? []) as { offer_id: number; step: Step }[]).map((c) => taskKey({ offerId: c.offer_id, step: c.step })));
    if (conflicts.size === 0) return toPayload(world, list);
    if (attempt >= MAX_ATTEMPTS) {
      const kept = list.tasks.filter((t) => !conflicts.has(taskKey(t)));
      return toPayload(world, { ...list, tasks: kept });
    }
  }
}
