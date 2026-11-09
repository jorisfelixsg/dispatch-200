"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Clock, Loader2 } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useTaskList } from "@/hooks/useTaskList";
import type { Step } from "@/lib/engine/config";
import type { EmptyReason } from "@/lib/engine/taskList";
import { formatSimShort } from "@/lib/engine/time";
import type { TaskView } from "@/lib/live/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Short reason shown on each task: what finishing it unblocks (from R1 and R2). */
const REASONS: Record<Step, string> = {
  S1: "débloque S3",
  S2: "débloque S3 et S4",
  S3: "débloque S5",
  S4: "débloque le compteur 24h",
  S5: "publie l'offre",
};

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

/** E1 — « Mes tâches » (contributors). */
export function TasksScreen() {
  const { profile } = useProfile();
  const { state, markDone } = useTaskList(profile);
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const onDone = async (task: TaskView) => {
    const key = `${task.offerId}:${task.step}`;
    setPending(key);
    setFeedback(null);
    const outcome = await markDone(task.offerId, task.step);
    setPending(null);
    setFeedback(
      outcome.ok
        ? { ok: true, text: `${task.step} · ${task.merchantName} : fait, fin à ${formatSimShort(outcome.doneAtSim ?? 0)}.` }
        : { ok: false, text: outcome.message },
    );
  };

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

  if (state.status === "error") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Mes tâches</h1>
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          Impossible de calculer ta liste : {state.message}
        </p>
      </section>
    );
  }

  const p = state.payload;
  const total = p.tasks.reduce((s, t) => s + t.duration, 0);
  const usedPct = p.budget > 0 ? Math.min(100, Math.round((p.consumed / p.budget) * 100)) : 100;
  const empty = emptyMessage(p.emptyReason, p.remaining);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mes tâches</h1>
          <p className="text-sm text-muted-foreground">
            {p.tasks.length > 0 ? `${p.tasks.length} tâche${p.tasks.length > 1 ? "s" : ""} · ${total} min` : "Aucune tâche proposée"}
          </p>
        </div>
        <div className="w-full rounded-xl border border-border bg-card p-3 sm:w-72" aria-live="polite">
          <p className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Budget du jour</span>
            <span>
              <span className="font-mono text-base font-semibold tabular-nums">{p.remaining}</span>
              <span className="text-muted-foreground"> / {p.budget} min restantes</span>
            </span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className={cn("h-full rounded-full", p.remaining === 0 ? "bg-warn" : "bg-primary")} style={{ width: `${usedPct}%` }} />
          </div>
        </div>
      </header>

      {p.autoRunning && (
        <p role="status" className="rounded-md border border-warn/30 bg-warn/10 p-3 text-sm font-medium text-warn">
          Simulation en cours : les boutons « Fait » sont désactivés.
        </p>
      )}

      {feedback && (
        <p role="status" className={cn("rounded-md border p-3 text-sm", feedback.ok ? "border-ok/30 bg-ok/10 text-ok" : "border-danger/30 bg-danger/10 text-danger")}>
          {feedback.text}
        </p>
      )}

      {p.tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-6">
          <p className="font-medium">{empty.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{empty.detail}</p>
        </div>
      ) : (
        <ol className="space-y-2">
          {p.tasks.map((t, i) => {
            const key = `${t.offerId}:${t.step}`;
            return (
              <li key={key} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <span className="hidden w-6 text-right font-mono text-xs tabular-nums text-muted-foreground sm:block">{i + 1}</span>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-semibold text-primary">
                  {t.step}
                </span>
                <Image src={t.logoUrl} alt="" width={36} height={36} unoptimized className="hidden size-9 shrink-0 rounded-lg sm:block" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.merchantName}</p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>rang {t.rank}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" aria-hidden />
                      {t.duration} min
                    </span>
                    <Badge variant={t.major ? "default" : "outline"} className="px-2 py-0">
                      {t.major ? "majeure" : "secondaire"}
                    </Badge>
                    <span>{REASONS[t.step]}</span>
                  </p>
                </div>
                <Button
                  onClick={() => void onDone(t)}
                  disabled={p.autoRunning || pending !== null}
                  aria-label={`Fait : ${t.step} ${t.merchantName}`}
                  className="shrink-0"
                >
                  {pending === key ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                  Fait
                </Button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
