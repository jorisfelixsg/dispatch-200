"use client";

import { BUSINESS_DAYS, OFFER_COUNT } from "@/lib/engine/config";
import type { ControlPayload } from "@/lib/live/contracts";
import { planGap } from "@/lib/ui/towerText";

const x = (day: number) => 20 + (day - 1) * 20;
const y = (v: number) => 120 - (v / OFFER_COUNT) * 105;
const points = (values: readonly number[]) => values.map((v, i) => `${x(i + 1)},${y(v)}`).join(" ");
const MONO = "var(--font-geist-mono), ui-monospace, monospace";

/** Tower v2 — compact actual vs reference curve (US-15), with the gap written out. */
export function RhythmCard({ payload }: { payload: ControlPayload }) {
  const { actualCurve: actual, referenceCurve: reference } = payload;
  const today = payload.today ?? BUSINESS_DAYS;
  const gap = planGap(actual, reference, today);
  const last = actual.length;
  const published = payload.indicators.published;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 md:p-5">
      <h2 className="text-lg font-semibold">Le rythme</h2>
      <svg viewBox="0 0 470 150" className="block h-auto w-full" role="img" aria-label={`Offres publiées cumulées : ${published} réelles${gap ? `, ${gap.planned} prévues à la fin de J${gap.day}` : ""}`}>
        <line x1={20} y1={120} x2={440} y2={120} style={{ stroke: "var(--border)" }} />
        <line x1={20} y1={15} x2={440} y2={15} strokeDasharray="2 3" style={{ stroke: "var(--border)" }} />
        {reference && <polyline points={points(reference)} strokeWidth={1.5} strokeDasharray="4 3" style={{ fill: "none", stroke: "var(--muted-foreground)" }} />}
        {last > 0 && (
          <>
            <polyline points={points(actual)} strokeWidth={2.5} strokeLinejoin="round" style={{ fill: "none", stroke: "var(--series-1)" }} />
            <circle cx={x(last)} cy={y(actual[last - 1])} r={3.5} style={{ fill: "var(--series-1)" }} />
            <text x={x(last) + 6} y={y(actual[last - 1]) + 16} fontSize={11} fontFamily={MONO} style={{ fill: "var(--foreground)" }}>
              {actual[last - 1]}
            </text>
          </>
        )}
        {gap && (
          <>
            <circle cx={x(gap.day)} cy={y(gap.planned)} r={2.5} style={{ fill: "var(--muted-foreground)" }} />
            <text x={x(gap.day) - 6} y={y(gap.planned) - 8} fontSize={11} fontFamily={MONO} textAnchor="end" style={{ fill: "var(--muted-foreground)" }}>
              plan {gap.planned}
            </text>
          </>
        )}
        <text x={20} y={140} fontSize={10} fontFamily={MONO} style={{ fill: "var(--muted-foreground)" }}>
          J1
        </text>
        <text x={440} y={140} fontSize={10} fontFamily={MONO} textAnchor="end" style={{ fill: "var(--muted-foreground)" }}>
          J{BUSINESS_DAYS}
        </text>
        <text x={444} y={11} fontSize={10} fontFamily={MONO} textAnchor="end" style={{ fill: "var(--muted-foreground)" }}>
          {OFFER_COUNT}
        </text>
      </svg>
      <p className="text-sm">
        {!reference ? (
          <span className="text-muted-foreground">Plan absent : réinitialise la démo (écran Simulation) pour le calculer.</span>
        ) : !gap ? (
          <span className="text-muted-foreground">La comparaison avec le plan commence au J2.</span>
        ) : gap.gap > 0 ? (
          <>
            <b className="text-danger">{gap.gap} offres de retard</b> sur le plan à la fin de J{gap.day}.
          </>
        ) : gap.gap < 0 ? (
          <>
            <b className="text-ok">{-gap.gap} offres d&apos;avance</b> sur le plan à la fin de J{gap.day}.
          </>
        ) : (
          <>
            <b className="text-ok">Pile dans le plan</b> à la fin de J{gap.day}.
          </>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        <span style={{ color: "var(--series-1)" }}>━</span> réel · ┅ plan calculé au début du mois
      </p>
    </section>
  );
}
