"use client";

import type { ControlPayload, ControlResponse } from "./contracts";
import { debounce, subscribeChanges } from "./changes";

// Shared control-tower report (R9, R10) for the top bar level and the E2 screen. Recomputed by the
// server on every pushed change (R6), at most once per burst.

export interface ControlSnapshot {
  status: "loading" | "ok" | "error";
  payload: ControlPayload | null;
  error?: string;
}

const SERVER_SNAPSHOT: ControlSnapshot = { status: "loading", payload: null };
let snapshot: ControlSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();
let unsubscribe: (() => void) | null = null;
let sequence = 0;

function emit(next: ControlSnapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

export async function refreshControlReport(): Promise<void> {
  const seq = ++sequence;
  try {
    const res = await fetch("/api/control", { cache: "no-store" });
    const body = (await res.json()) as ControlResponse;
    if (seq !== sequence) return;
    if (body.ok) emit({ status: "ok", payload: body.payload });
    else emit({ status: "error", payload: snapshot.payload, error: body.error });
  } catch (e) {
    if (seq === sequence) emit({ status: "error", payload: snapshot.payload, error: e instanceof Error ? e.message : String(e) });
  }
}

const later = typeof window === "undefined" ? null : debounce(() => void refreshControlReport(), 100);

export function subscribeControlReport(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refreshControlReport();
    unsubscribe = subscribeChanges(() => later?.run());
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      unsubscribe?.();
      unsubscribe = null;
      later?.cancel();
    }
  };
}

export function getControlSnapshot(): ControlSnapshot {
  return snapshot;
}

export function getServerControlSnapshot(): ControlSnapshot {
  return SERVER_SNAPSHOT;
}
