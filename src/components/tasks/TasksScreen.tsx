"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, PictureInPicture2 } from "lucide-react";
import { useDeferredDone } from "@/hooks/useDeferredDone";
import { useProfile } from "@/hooks/useProfile";
import { useTaskList } from "@/hooks/useTaskList";
import type { EmptyReason } from "@/lib/engine/taskList";
import type { TaskView } from "@/lib/live/contracts";
import { STEP_NAMES } from "@/lib/ui/taskKit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AbsencePanel } from "./AbsencePanel";
import { useMiniWindow, useMiniWindowSupported } from "./MiniWindow";
import { TaskCard } from "./TaskCard";

const keyOf = (t: TaskView) => `${t.offerId}:${t.step}`;

function emptyMessage(reason: EmptyReason | null, remaining: number): { title: string; detail: string } {
  switch (reason) {
    case "budgetExhausted":
      return { title: "Ton heure du jour est faite.", detail: "Ton budget revient au prochain jour ouvré." };
    case "absent":
      return { title: "Tu es absent aujourd'hui.", detail: "Aucune tâche ne t'est proposée ce jour-là." };
    case "noSkills":
      return { title: "Aucune tâche pour ce profil.", detail: "Ce profil n'a aucune compétence active." };
    case "nothingFits":
      return {
        title: `Il te reste ${remaining} min, mais aucune tâche prête ne tient dans ce temps.`,
        detail: "Ton budget revient au prochain jour ouvré.",
      };
    default:
      return { title: "Rien n'est prêt pour toi pour l'instant.", detail: "La liste se met à jour toute seule dès qu'une tâche se débloque." };
  }
}

interface Feedback {
  ok: boolean;
  text: string;
}

/** What comes after the current card, in a few words (the list itself is no longer shown). */
function nextHint(current: TaskView, next: TaskView | undefined): string {
  if (!next) return "C'est la dernière tâche de ta liste pour l'instant.";
  if (next.offerId === current.offerId) return "Ensuite : une autre étape du même marchand.";
  if (next.step === current.step) return "Ensuite : le marchand suivant, mêmes gestes.";
  return `Ensuite : ${STEP_NAMES[next.step].toLowerCase()}.`;
}

/** E1 — « Mes tâches » v2 (PM decision 2026-11-11): one card at a time, its execution kit, undo, mini window. */
export function TasksScreen() {
  const { profile } = useProfile();
  const { state, markDone, declareAbsence } = useTaskList(profile);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const onError = useCallback(
    (task: TaskView, message: string) => setFeedback({ ok: false, text: `${task.step} · ${task.merchantName} : ${message}` }),
    [],
  );
  const { pending, done, undo } = useDeferredDone(markDone, onError);
  const mini = useMiniWindow();
  const miniSupported = useMiniWindowSupported();

  const payload = state.status === "ready" ? state.payload : null;
  const pendingKey = pending ? keyOf(pending) : null;
  // Tasks still to do: the engine's list (R5) without the one waiting for its « Annuler » delay.
  const tasks = payload ? payload.tasks.filter((t) => keyOf(t) !== pendingKey) : [];
  // PM 2026-11-11: while « Annuler » is possible, the validated card stays on screen; the next task
  // only shows once the delay is over.
  const current = pending ?? tasks[0];
  const disabled = !payload || payload.autoRunning;

  const validate = () => {
    if (pending || !current || disabled) return;
    setFeedback(null);
    done(current);
  };
  // The keyboard listener always calls the latest validate().
  const validateRef = useRef(validate);
  useEffect(() => {
    validateRef.current = validate;
  });

  // Entrée = Fait, Ctrl+Z = Annuler, in the page and in the mini window.
  useEffect(() => {
    const docs = [document, mini.pip?.document].filter((d): d is Document => Boolean(d));
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (e.key === "Enter" && !target?.closest("button, a")) {
        e.preventDefault();
        validateRef.current();
      }
    };
    docs.forEach((d) => d.addEventListener("keydown", onKey));
    return () => docs.forEach((d) => d.removeEventListener("keydown", onKey));
  }, [undo, mini.pip]);

  if (state.status === "loading") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Mes tâches</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Calcul de ta liste…
        </p>
      </section>
    );
  }

  if (state.status === "error" || !payload) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Mes tâches</h1>
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          Impossible de calculer ta liste : {state.status === "error" ? state.message : "état inconnu"}
        </p>
      </section>
    );
  }

  const pendingMin = pending?.duration ?? 0;
  const remainingMin = Math.max(0, payload.remaining - pendingMin);
  const usedPct = payload.budget > 0 ? Math.min(100, Math.round(((payload.consumed + pendingMin) / payload.budget) * 100)) : 100;
  const empty = emptyMessage(payload.emptyReason, payload.remaining);
  const summary = pending
    ? `${tasks.length > 0 ? `Ensuite : encore ${tasks.length} tâche${tasks.length > 1 ? "s" : ""}` : "C'était la dernière tâche de ta liste"} · ${remainingMin} min de budget`
    : current
      ? `Encore ${tasks.length} tâche${tasks.length > 1 ? "s" : ""} · ${remainingMin} min de budget`
      : `${remainingMin} min de budget`;

  const banner = payload.autoRunning && (
    <p role="status" className="rounded-md border border-warn/30 bg-warn/10 p-3 text-sm font-medium text-warn">
      Simulation en cours : le bouton « Fait » est désactivé.
    </p>
  );

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Mes tâches</h1>
          {miniSupported && (
            <Button variant="outline" size="sm" className="h-11 sm:h-9" onClick={() => void (mini.pip ? mini.close() : mini.open())}>
              <PictureInPicture2 aria-hidden />
              {mini.pip ? "Fermer la mini-fenêtre" : "Ouvrir la mini-fenêtre"}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {summary}
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className={cn("h-full rounded-full transition-all", remainingMin === 0 ? "bg-warn" : "bg-primary")}
            style={{ width: `${usedPct}%` }}
          />
        </div>
      </header>

      {banner}

      {feedback && (
        <p
          role="status"
          className={cn("rounded-md border p-3 text-sm", feedback.ok ? "border-ok/30 bg-ok/10 text-ok" : "border-danger/30 bg-danger/10 text-danger")}
        >
          {feedback.text}
        </p>
      )}

      {current ? (
        <TaskCard key={keyOf(current)} task={current} onDone={validate} onUndo={pending ? undo : undefined} disabled={disabled} />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-6">
          <p className="font-medium">{empty.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{empty.detail}</p>
        </div>
      )}

      {current && !pending && <p className="text-sm text-muted-foreground">{nextHint(current, tasks[1])}</p>}

      {profile !== "orchestrator" && <AbsencePanel today={payload.dayIndex} absences={payload.absences} onDeclare={declareAbsence} />}

      {mini.render(
        <div className="grid gap-2 p-3">
          {banner}
          {current ? (
            <TaskCard key={keyOf(current)} task={current} onDone={validate} onUndo={pending ? undo : undefined} disabled={disabled} compact />
          ) : (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm">
              <span className="font-medium">{empty.title}</span>
              <br />
              <span className="text-muted-foreground">{empty.detail}</span>
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">{summary}</p>
        </div>,
      )}
    </section>
  );
}
