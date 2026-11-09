"use client";

import type { SimStateRow } from "@/lib/data/rows";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { subscribeChanges } from "./changes";

// Shared simulation state (sim_state singleton), read with the anon key.
// Refreshed on every sim_state change pushed by Realtime, or by the 2 s fallback poll (R6).

export type SimStateStatus = "loading" | "ok" | "empty" | "error" | "unconfigured";

export interface SimStateSnapshot {
  status: SimStateStatus;
  state: SimStateRow | null;
}

const SERVER_SNAPSHOT: SimStateSnapshot = { status: "loading", state: null };

let snapshot: SimStateSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();
let unsubscribeChanges: (() => void) | null = null;
let inFlight: Promise<void> | null = null;

function emit(next: SimStateSnapshot) {
  const prev = snapshot;
  if (
    prev.status === next.status &&
    prev.state?.updated_at === next.state?.updated_at &&
    prev.state?.now_sim === next.state?.now_sim &&
    prev.state?.epoch === next.state?.epoch
  ) {
    return;
  }
  snapshot = next;
  listeners.forEach((l) => l());
}

/** Fetch sim_state now (also called right after an action for instant feedback). */
export function refreshSimState(): Promise<void> {
  if (inFlight) return inFlight;
  const supabase = getBrowserSupabase();
  if (!supabase) {
    emit({ status: "unconfigured", state: null });
    return Promise.resolve();
  }
  inFlight = (async () => {
    try {
      const { data, error } = await supabase
        .from("sim_state")
        .select("now_sim, seed, auto_running, reference_curve, renfort_s1, epoch, updated_at")
        .eq("id", 1)
        .maybeSingle<SimStateRow>();
      if (error) emit({ status: "error", state: snapshot.state });
      else emit({ status: data ? "ok" : "empty", state: data });
    } catch {
      emit({ status: "error", state: snapshot.state });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function subscribeSimState(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refreshSimState();
    unsubscribeChanges = subscribeChanges((source) => {
      if (source === "sim_state" || source === "poll") void refreshSimState();
    });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && unsubscribeChanges) {
      unsubscribeChanges();
      unsubscribeChanges = null;
    }
  };
}

export function getSimStateSnapshot(): SimStateSnapshot {
  return snapshot;
}

export function getServerSimStateSnapshot(): SimStateSnapshot {
  return SERVER_SNAPSHOT;
}
