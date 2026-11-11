"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Step } from "@/lib/engine/config";
import type { TaskView } from "@/lib/live/contracts";
import { UNDO_DELAY_MS } from "@/lib/ui/taskKit";
import type { DoneOutcome } from "./useTaskList";

interface Pending {
  task: TaskView;
  timer: number;
}

/**
 * « Fait » with an « Annuler » window (PM decision 2026-11-11): the step is only sent to the server
 * once the undo delay is over. Undo therefore just forgets the click: nothing was recorded.
 * The validated card stays on screen during the delay (PM, 2026-11-11); leaving the page or
 * unmounting sends the pending step at once.
 */
export function useDeferredDone(
  markDone: (offerId: number, step: Step) => Promise<DoneOutcome>,
  onError: (task: TaskView, message: string) => void,
) {
  const [pending, setPending] = useState<TaskView | null>(null);
  const current = useRef<Pending | null>(null);
  const errorHandler = useRef(onError);
  useEffect(() => {
    errorHandler.current = onError;
  }, [onError]);

  const flush = useCallback(() => {
    const p = current.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    current.current = null;
    setPending(null);
    void markDone(p.task.offerId, p.task.step).then((outcome) => {
      if (!outcome.ok) errorHandler.current(p.task, outcome.message);
    });
  }, [markDone]);

  const done = useCallback(
    (task: TaskView) => {
      flush();
      current.current = { task, timer: window.setTimeout(flush, UNDO_DELAY_MS) };
      setPending(task);
    },
    [flush],
  );

  const undo = useCallback(() => {
    const p = current.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    current.current = null;
    setPending(null);
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  return { pending, done, undo };
}
