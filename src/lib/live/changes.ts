"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser";

// R6 — one shared Supabase Realtime channel for the whole tab. Listeners are told which table
// changed. When Realtime is not connected, a 2 s poll emits "poll" instead (fallback).

export type ChangeSource =
  | "step_execution"
  | "sim_state"
  | "person"
  | "day_adjustment"
  | "applied_action"
  | "offer"
  | "poll";

const TABLES: Exclude<ChangeSource, "poll">[] = [
  "step_execution",
  "sim_state",
  "person",
  "day_adjustment",
  "applied_action",
  "offer",
];

export const FALLBACK_POLL_MS = 2000;

export type RealtimeStatus = "connecting" | "live" | "polling";

type Listener = (source: ChangeSource) => void;

const listeners = new Set<Listener>();
const statusListeners = new Set<() => void>();
let channel: RealtimeChannel | null = null;
let pollTimer: number | null = null;
let status: RealtimeStatus = "connecting";

function setStatus(next: RealtimeStatus) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((l) => l());
}

function emit(source: ChangeSource) {
  listeners.forEach((l) => l(source));
}

function startPolling() {
  if (pollTimer !== null) return;
  pollTimer = window.setInterval(() => emit("poll"), FALLBACK_POLL_MS);
}

function stopPolling() {
  if (pollTimer === null) return;
  window.clearInterval(pollTimer);
  pollTimer = null;
}

function connect() {
  const supabase = getBrowserSupabase();
  if (!supabase) {
    setStatus("polling");
    startPolling();
    return;
  }
  let ch = supabase.channel("dispatch200-changes");
  for (const table of TABLES) {
    ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, () => emit(table));
  }
  // Until Realtime confirms the subscription, the poll keeps everyone in sync.
  startPolling();
  channel = ch.subscribe((s) => {
    if (s === "SUBSCRIBED") {
      stopPolling();
      setStatus("live");
      emit("poll"); // catch up on anything missed while connecting
    } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
      setStatus("polling");
      startPolling();
    }
  });
}

function disconnect() {
  stopPolling();
  const supabase = getBrowserSupabase();
  if (channel && supabase) void supabase.removeChannel(channel);
  channel = null;
  setStatus("connecting");
}

/** Subscribe to database changes (R6). The channel lives while at least one listener exists. */
export function subscribeChanges(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) connect();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) disconnect();
  };
}

export function subscribeRealtimeStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export function getRealtimeStatus(): RealtimeStatus {
  return status;
}

/** Calls `fn` at most once per `ms`, after the last call (coalesces bursts of changes). */
export function debounce(fn: () => void, ms: number): { run: () => void; cancel: () => void } {
  let timer: number | null = null;
  return {
    run: () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        fn();
      }, ms);
    },
    cancel: () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    },
  };
}
