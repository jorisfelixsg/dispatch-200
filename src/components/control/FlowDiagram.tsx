"use client";

import { OFFER_COUNT, type Step } from "@/lib/engine/config";
import type { Level } from "@/lib/engine/controls";
import type { PersonId } from "@/lib/engine/people";
import type { ControlPayload } from "@/lib/live/contracts";
import { STEP_NAMES } from "@/lib/ui/steps";
import { marginPhrase, names, worstControl } from "@/lib/ui/towerText";

// Short names so each box fits; the full names are in STEP_NAMES.
const SHORT: Record<Step, string> = { ...STEP_NAMES, S1: "Préparer le contenu" };

const BOX = { w: 200, h: 124 };
const POS: Record<Step, { x: number; y: number; w: number }> = {
  S1: { x: 20, y: 20, w: 200 },
  S2: { x: 20, y: 210, w: 200 },
  S3: { x: 380, y: 20, w: 200 },
  S4: { x: 380, y: 230, w: 200 },
  S5: { x: 760, y: 122, w: 220 },
};

const LEVEL_VAR: Record<Level, string> = { green: "var(--ok)", orange: "var(--warn)", red: "var(--danger)" };
const MONO = "var(--font-geist-mono), ui-monospace, monospace";

function who(ids: readonly PersonId[], deadline: number | null): string {
  const contributors: PersonId[] = ["alice", "bob", "charlie"];
  const everyone = contributors.every((id) => ids.includes(id));
  const people = everyone ? `Tous${ids.includes("orchestrator") ? " + vous" : ""}` : names(ids);
  return deadline ? `${people} · avant J${deadline}` : people;
}

function Badge({ x, y, w, text, hot }: { x: number; y: number; w: number; text: string; hot: boolean }) {
  return (
    <g fontFamily={MONO} fontSize={12}>
      <rect x={x} y={y} width={w} height={24} rx={12} style={{ fill: hot ? "var(--danger)" : "var(--muted)" }} />
      <text x={x + w / 2} y={y + 16} textAnchor="middle" fontWeight={hot ? 600 : 400} style={{ fill: hot ? "#fff" : "var(--foreground)" }}>
        {text}
      </text>
    </g>
  );
}

/** Tower v2 — how an offer moves through S1–S5 (R1, R2), who works where, and where it is stuck (R9). */
export function FlowDiagram({ payload }: { payload: ControlPayload }) {
  const { flow, indicators, controls, level } = payload;
  const byId = new Map(controls.map((c) => [c.id, c]));
  const worst = level === "green" ? null : worstControl(controls);
  const global = byId.get("global") ?? null;
  const hotStep = worst && worst.id !== "global" ? (worst.id as Step) : null;

  const station = (step: Step) => {
    const { x, y, w } = POS[step];
    const control = step === "S1" ? null : (byId.get(step) ?? null);
    const hot = hotStep === step ? worst!.level : null;
    const done = indicators.doneByStep[step];
    const barW = w - 32;
    const stroke = hot ? LEVEL_VAR[hot] : control && control.level !== "green" ? LEVEL_VAR[control.level] : "var(--border)";
    return (
      <g key={step}>
        <rect
          x={x}
          y={y}
          width={w}
          height={BOX.h}
          rx={12}
          style={{
            fill: hot ? `color-mix(in srgb, ${LEVEL_VAR[hot]} 10%, var(--card))` : "var(--card)",
            stroke,
            strokeWidth: hot ? 2 : control && control.level !== "green" ? 1.5 : 1,
          }}
        />
        <text x={x + 16} y={y + 26} fontSize={14} fontWeight={600} style={{ fill: "var(--foreground)" }}>
          {step} · {SHORT[step]}
        </text>
        <text x={x + 16} y={y + 46} fontSize={12} style={{ fill: "var(--muted-foreground)" }}>
          {who(flow.skilled[step], control?.deadlineDay ?? null)}
        </text>
        <rect x={x + 16} y={y + 60} width={barW} height={6} rx={3} style={{ fill: "var(--muted)" }} />
        <rect x={x + 16} y={y + 60} width={(barW * done) / OFFER_COUNT} height={6} rx={3} style={{ fill: hot ? LEVEL_VAR[hot] : "var(--primary)" }} />
        <text x={x + 16} y={y + 84} fontSize={12} fontFamily={MONO} style={{ fill: "var(--foreground)" }}>
          {done} / {OFFER_COUNT} {step === "S5" ? "publiées" : "faites"}
        </text>
        {control ? (
          <text x={x + 16} y={y + 108} fontSize={12} fontWeight={hot ? 700 : 600} style={{ fill: LEVEL_VAR[control.level] }}>
            {control.need === 0 ? "Fait" : marginPhrase(control.margin).replace(/^./, (c) => c.toUpperCase())}
          </text>
        ) : (
          <text x={x + 16} y={y + 108} fontSize={12} style={{ fill: "var(--muted-foreground)" }}>
            Pas d&apos;échéance propre
          </text>
        )}
        {hot && (
          <text x={x} y={y + BOX.h + 22} fontSize={12} fontWeight={600} style={{ fill: LEVEL_VAR[hot] }}>
            {hot === "red" ? "Ça bloque ici" : "Point le plus juste"}
          </text>
        )}
      </g>
    );
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Comment avance une offre, et où ça bloque</h2>
        <span className="text-xs text-muted-foreground">Avance ou retard de chaque étape d&apos;ici son échéance</span>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span>
          <b className="font-medium text-foreground">Une flèche</b> : l&apos;étape de gauche doit être faite avant celle de droite
        </span>
        <span>
          <b className="font-medium text-foreground">Pastille</b> : offres prêtes qui attendent cette étape
        </span>
        <span>
          <b className="font-medium text-foreground">Logo → publication</b> : 24 h d&apos;attente obligatoire
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 1000 380"
          className="block h-auto w-full min-w-[760px]"
          role="img"
          aria-label={`Parcours d'une offre : S1 et S2 avant S3, S2 avant S4, S3 et S4 avant S5. ${flow.ready.S3} offres attendent S3, ${flow.ready.S4} attendent S4, ${flow.ready.S5} attendent S5, ${flow.waiting24h} dans le délai de 24 h. ${controls
            .filter((c) => c.id !== "global")
            .map((c) => `${c.id} : ${c.need === 0 ? "fait" : marginPhrase(c.margin)}`)
            .join(", ")}.${hotStep ? ` ${hotStep} : ${worst!.level === "red" ? "ça bloque ici" : "point le plus juste"}.` : ""}`}
        >
          <defs>
            <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: "var(--muted-foreground)" }} />
            </marker>
          </defs>
          <g style={{ fill: "none", stroke: "var(--muted-foreground)", strokeWidth: 1.5 }}>
            <path d="M220,80 L376,80" markerEnd="url(#flow-arrow)" />
            <path d="M220,260 C300,260 300,110 376,110" markerEnd="url(#flow-arrow)" />
            <path d="M220,290 L376,290" markerEnd="url(#flow-arrow)" />
            <path d="M580,80 C670,80 670,170 756,170" markerEnd="url(#flow-arrow)" />
            <path d="M580,290 C670,290 670,200 756,200" markerEnd="url(#flow-arrow)" />
          </g>
          <Badge x={258} y={40} w={104} text={`${flow.ready.S3} en attente`} hot={hotStep === "S3"} />
          <Badge x={258} y={302} w={104} text={`${flow.ready.S4} en attente`} hot={hotStep === "S4"} />
          <Badge x={636} y={104} w={104} text={`${flow.ready.S5} en attente`} hot={hotStep === "S5"} />
          <Badge x={598} y={302} w={150} text={`${flow.waiting24h} dans les 24 h`} hot={false} />
          <g fontFamily="var(--font-geist-sans), system-ui, sans-serif">
            {(["S1", "S2", "S3", "S4", "S5"] as const).map(station)}
            {global && (
              <text x={980} y={372} fontSize={12} textAnchor="end" style={{ fill: "var(--muted-foreground)" }}>
                Toute l&apos;équipe, toutes étapes :{" "}
                <tspan fontWeight={600} style={{ fill: LEVEL_VAR[global.level] }}>
                  {global.need === 0 ? "tout est fait" : marginPhrase(global.margin)}
                </tspan>
              </text>
            )}
          </g>
        </svg>
      </div>
    </section>
  );
}
