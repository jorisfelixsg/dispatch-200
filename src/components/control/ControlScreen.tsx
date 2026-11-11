"use client";

import { ChevronRight, Loader2 } from "lucide-react";
import { useControlReport } from "@/hooks/useControlReport";
import type { ControlResult, Level } from "@/lib/engine/controls";
import { getDefaultPerson } from "@/lib/engine/people";
import { formatSim } from "@/lib/engine/time";
import type { ControlPayload } from "@/lib/live/contracts";
import { LEVEL_LABEL } from "@/components/LevelPill";
import { cn } from "@/lib/utils";
import { ActionsPanel } from "./ActionsPanel";
import { FlowDiagram } from "./FlowDiagram";
import { RhythmCard } from "./RhythmCard";
import { TeamToday } from "./TeamToday";
import { TowerHero } from "./TowerHero";

const LEVEL_BADGE: Record<Level, string> = {
  green: "bg-ok/15 text-ok",
  orange: "bg-warn/15 text-warn",
  red: "bg-danger/15 text-danger",
};

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

function signedDays(n: number): string {
  const text = Math.abs(n).toFixed(1).replace(".", ",");
  return n > 0 ? `+${text} j` : n < 0 ? `−${text} j` : "0 j";
}

function controlName(c: ControlResult): string {
  return c.id === "global" ? "Global" : `Étape ${c.id}`;
}

function competentNames(c: ControlResult): string {
  if (c.id === "global") return "Toute l'équipe";
  if (c.competent.length === 0) return "Personne";
  return c.competent.map((id) => getDefaultPerson(id).name).join(", ");
}

function LevelBadge({ level }: { level: Level }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", LEVEL_BADGE[level])}>
      <span className={cn("size-2 rounded-full", level === "green" ? "bg-ok" : level === "orange" ? "bg-warn" : "bg-danger")} aria-hidden />
      {LEVEL_LABEL[level]}
    </span>
  );
}

/** R9 table (minutes) and R10 thresholds, folded under « Détail des calculs ». The US-15 curve is in « Le rythme ». */
function CalculationDetails({ payload }: { payload: ControlPayload }) {
  const { controls } = payload;
  return (
    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span>Détail des calculs : contrôles en minutes, seuils des niveaux</span>
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
      </summary>
      <div className="space-y-6 border-t border-border p-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">Contrôles de capacité</h3>
            <p className="text-xs text-muted-foreground">Vert : marge &gt; 60 min · Orange : 0 à 60 min · Rouge : marge négative</p>
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Contrôle</th>
                  <th scope="col" className="px-3 py-2 font-medium">Échéance</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Besoin</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Capacité</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Marge</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">En jours</th>
                  <th scope="col" className="px-3 py-2 font-medium">Niveau</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {controls.map((c) => (
                  <tr key={c.id} className={cn(c.id === "global" && "bg-muted/30")}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{controlName(c)}</p>
                      <p className="text-xs text-muted-foreground">{competentNames(c)}</p>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">J{c.deadlineDay}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{c.need} min</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{c.capacity} min</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">{signed(c.margin)} min</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">{signedDays(c.marginDays)}</td>
                    <td className="px-3 py-2">
                      <LevelBadge level={c.level} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {controls.map((c) => (
              <li key={c.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {controlName(c)} <span className="font-mono text-xs text-muted-foreground">· échéance J{c.deadlineDay}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{competentNames(c)}</p>
                  </div>
                  <LevelBadge level={c.level} />
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Besoin</dt>
                    <dd className="font-mono tabular-nums">{c.need} min</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Capacité</dt>
                    <dd className="font-mono tabular-nums">{c.capacity} min</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Marge</dt>
                    <dd className="font-mono font-semibold tabular-nums">
                      {signed(c.margin)} min <span className="font-normal text-muted-foreground">({signedDays(c.marginDays)})</span>
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

/**
 * E2 — Tour de contrôle (orchestrator), v2 (PM 2026-11-11): readable by a stand-in at a glance.
 * Verdict, what to do, how an offer moves and where it is stuck, the team today, the rhythm;
 * the R9 figures stay available under « Détail des calculs ». Same rules, same live refresh (R6).
 */
export function ControlScreen() {
  const { status, payload, error } = useControlReport();

  if (!payload) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Tour de contrôle</h1>
        {status === "error" ? (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            Impossible de calculer la tour de contrôle : {error}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Calcul des contrôles…
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Tour de contrôle</h1>
        <p className="text-xs text-muted-foreground">Mis à jour en direct · {formatSim(payload.nowSim)}</p>
      </header>
      <TowerHero payload={payload} />
      <ActionsPanel payload={payload} />
      <FlowDiagram payload={payload} />
      <div className="grid gap-4 md:grid-cols-2">
        <TeamToday payload={payload} />
        <RhythmCard payload={payload} />
      </div>
      <CalculationDetails payload={payload} />
    </section>
  );
}
