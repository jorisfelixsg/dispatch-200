"use client";

import { BUSINESS_DAYS, OFFER_COUNT } from "@/lib/engine/config";
import type { Level } from "@/lib/engine/controls";
import type { PersonId } from "@/lib/engine/people";
import type { ControlPayload } from "@/lib/live/contracts";
import { daysLeft, planGap, verdict, worstControl } from "@/lib/ui/towerText";
import { LevelPill } from "@/components/LevelPill";
import { cn } from "@/lib/utils";
import { ProjectionKpi } from "./ProjectionCard";

const HERO: Record<Level, string> = {
  green: "border-ok/30 bg-ok/10",
  orange: "border-warn/30 bg-warn/10",
  red: "border-danger/30 bg-danger/10",
};

/** Tower v2 — what is happening, in one sentence, and the three numbers that frame it. */
export function TowerHero({ payload }: { payload: ControlPayload }) {
  const today = payload.today ?? BUSINESS_DAYS;
  const absentDaysOf = (id: PersonId) => payload.team.find((m) => m.personId === id)?.absentDays ?? [];
  const v = verdict(payload.controls, payload.level, absentDaysOf, today);
  const gap = planGap(payload.actualCurve, payload.referenceCurve, today);

  return (
    <section className={cn("grid gap-5 rounded-2xl border p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center", HERO[payload.level])}>
      <div className="min-w-0 space-y-2">
        <LevelPill level={payload.level} prefix="Niveau" className="bg-card px-3 py-1 text-sm" />
        <h2 aria-live="polite" className="text-balance text-xl font-semibold leading-snug md:text-2xl">
          {v.headline}
        </h2>
        <p className="text-sm">{v.cause}</p>
      </div>
      <div className="flex flex-wrap gap-x-7 gap-y-4">
        <div className="grid content-start gap-1">
          <span className="text-xs text-muted-foreground">Offres publiées</span>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            {payload.indicators.published}
            <span className="text-sm font-normal text-muted-foreground"> / {OFFER_COUNT}</span>
          </p>
          {gap && (
            <span className="text-xs" title={`Comparé à la trajectoire prévue à la fin de J${gap.day} (${gap.planned} offres)`}>
              {gap.gap > 0 ? (
                <b className="text-danger">{gap.gap} de retard sur le plan</b>
              ) : gap.gap < 0 ? (
                <b className="text-ok">{-gap.gap} d&apos;avance sur le plan</b>
              ) : (
                <b className="text-ok">pile dans le plan</b>
              )}
            </span>
          )}
        </div>
        <div className="grid content-start gap-1">
          <span className="text-xs text-muted-foreground">Jours restants</span>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            {payload.indicators.endOfMonth ? 0 : daysLeft(today)}
            <span className="text-sm font-normal text-muted-foreground"> j</span>
          </p>
          <span className="text-xs text-muted-foreground">{payload.indicators.endOfMonth ? "Fin du mois" : "aujourd'hui compris"}</span>
        </div>
        <ProjectionKpi
          stateKey={`${payload.nowSim}|${payload.indicators.published}|${payload.controls.map((c) => c.margin).join(",")}`}
          safetyDeadline={payload.level === "green" ? null : (worstControl(payload.controls)?.deadlineDay ?? null)} />
      </div>
    </section>
  );
}
