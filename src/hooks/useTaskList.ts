"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RESERVATION_HEARTBEAT_MS, type Step } from "@/lib/engine/config";
import type { PersonId } from "@/lib/engine/people";
import { debounce, subscribeChanges } from "@/lib/live/changes";
import type { AbsenceResponse, DoneResponse, TasksPayload, TasksResponse } from "@/lib/live/contracts";

export type TaskListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; payload: TasksPayload };

const JUST_DONE_MS = 10_000;

export interface DoneOutcome {
  ok: boolean;
  message: string;
  doneAtSim?: number;
}

async function postJson<T>(url: string, body: unknown, keepalive = false): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive });
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`Erreur ${res.status}`);
  }
}

/**
 * Live "Mes tâches" list (R5–R7): recomputed by the server on every change pushed by Realtime
 * (or the 2 s fallback poll), and every 20 s as the reservation heartbeat.
 */
export function useTaskList(personId: PersonId | null | undefined) {
  const [state, setState] = useState<TaskListState>({ status: "loading" });
  const sequence = useRef(0);
  const lastApplied = useRef(0);
  // Tasks this person just validated: hidden from any list computed before the click committed.
  const justDone = useRef(new Map<string, number>());

  const apply = useCallback((seq: number, payload: TasksPayload | undefined, error?: string) => {
    if (seq < lastApplied.current) return; // an answer to a newer request is already shown
    lastApplied.current = seq;
    if (payload) {
      const now = Date.now();
      for (const [key, until] of justDone.current) if (until < now) justDone.current.delete(key);
      const tasks = payload.tasks.filter((t) => !justDone.current.has(`${t.offerId}:${t.step}`));
      setState({ status: "ready", payload: tasks.length === payload.tasks.length ? payload : { ...payload, tasks } });
    } else if (error) setState((prev) => (prev.status === "ready" ? prev : { status: "error", message: error }));
  }, []);

  const refresh = useCallback(async () => {
    if (!personId) return;
    const seq = ++sequence.current;
    try {
      const res = await postJson<TasksResponse>("/api/tasks", { personId });
      apply(seq, res.ok ? res.payload : undefined, res.ok ? undefined : res.error);
    } catch (e) {
      apply(seq, undefined, e instanceof Error ? e.message : String(e));
    }
  }, [personId, apply]);

  useEffect(() => {
    if (!personId) return;
    const later = debounce(() => void refresh(), 50);
    later.run();
    const unsubscribe = subscribeChanges((source) => {
      if (source !== "event") later.run();
    });
    const heartbeat = window.setInterval(() => void refresh(), RESERVATION_HEARTBEAT_MS);
    return () => {
      later.cancel();
      unsubscribe();
      window.clearInterval(heartbeat);
    };
  }, [personId, refresh]);

  const markDone = useCallback(
    async (offerId: number, step: Step): Promise<DoneOutcome> => {
      if (!personId) return { ok: false, message: "Aucun profil." };
      const seq = ++sequence.current;
      // Hidden at once, before the server answers, so the task never flashes back on screen;
      // done (or done by someone else): never shown again, even from a stale answer.
      const key = `${offerId}:${step}`;
      justDone.current.set(key, Date.now() + JUST_DONE_MS);
      setState((prev) =>
        prev.status === "ready"
          ? { ...prev, payload: { ...prev.payload, tasks: prev.payload.tasks.filter((t) => `${t.offerId}:${t.step}` !== key) } }
          : prev,
      );
      try {
        const res = await postJson<DoneResponse>("/api/tasks/done", { personId, offerId, step }, true);
        if (!res.ok && res.code !== "already_done") {
          // Refused: the task may come back with the server's list.
          justDone.current.delete(key);
          if (!res.payload) void refresh();
        }
        apply(seq, res.payload);
        return res.ok ? { ok: true, message: "", doneAtSim: res.doneAtSim } : { ok: false, message: res.error };
      } catch (e) {
        justDone.current.delete(key);
        void refresh();
        return { ok: false, message: e instanceof Error ? e.message : String(e) };
      }
    },
    [personId, apply, refresh],
  );

  const declareAbsence = useCallback(
    async (dayIndex: number): Promise<{ ok: boolean; message: string }> => {
      if (!personId) return { ok: false, message: "Aucun profil." };
      const seq = ++sequence.current;
      try {
        const res = await postJson<AbsenceResponse>("/api/absence", { personId, dayIndex });
        if (!res.ok) return { ok: false, message: res.error };
        apply(seq, res.payload);
        return { ok: true, message: `Absence déclarée pour J${dayIndex}.` };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) };
      }
    },
    [personId, apply],
  );

  return { state, refresh, markDone, declareAbsence };
}
