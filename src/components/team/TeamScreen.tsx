"use client";

import { useState } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { useSimState } from "@/hooks/useSimState";
import { useTeamData, type AppliedActionView } from "@/hooks/useTeamData";
import { BUSINESS_DAYS, DURATIONS, OFFER_COUNT, STEPS, type Step } from "@/lib/engine/config";
import { businessDayOf } from "@/lib/engine/clock";
import type { PersonId } from "@/lib/engine/people";
import { formatSimShort, SIM_START } from "@/lib/engine/time";
import type { DayAdjustment, Person } from "@/lib/engine/types";
import type { AbsenceResponse } from "@/lib/live/contracts";
import { cancelActionRequest } from "@/lib/live/actionsClient";
import { renfortFromRow } from "@/lib/data/rows";
import { ACTION_TITLES, describeAction } from "@/lib/ui/actionLabels";
import { STEP_NAMES, STEP_PREREQUISITES } from "@/lib/ui/steps";
import { PersonAvatar } from "@/components/PersonAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const selectClass =
  "h-11 rounded-md border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function days(list: number[]): string {
  return list.length > 0 ? list.map((d) => `J${d}`).join(", ") : "aucune";
}

function DeclareAbsence({ personId, today, declared }: { personId: PersonId; today: number; declared: number[] }) {
  const choices = Array.from({ length: BUSINESS_DAYS - today + 1 }, (_, i) => today + i).filter((d) => !declared.includes(d));
  const [day, setDay] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const selected = day !== null && choices.includes(day) ? day : choices[0];

  const submit = async () => {
    if (selected === undefined) return;
    setBusy(true);
    try {
      const res = await fetch("/api/absence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId, dayIndex: selected }),
      });
      const body = (await res.json()) as AbsenceResponse;
      setMessage(body.ok ? { ok: true, text: `Absence déclarée pour J${selected}.` } : { ok: false, text: body.error });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Déclarer une absence le</span>
          <select value={selected ?? ""} onChange={(e) => setDay(Number(e.target.value))} className={selectClass} disabled={choices.length === 0}>
            {choices.map((d) => (
              <option key={d} value={d}>
                J{d}
                {d === today ? " (aujourd'hui)" : ""}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" onClick={() => void submit()} disabled={busy || selected === undefined}>
          Déclarer
        </Button>
      </div>
      {message && <p role="status" className={cn("text-sm", message.ok ? "text-ok" : "text-danger")}>{message.text}</p>}
    </div>
  );
}

function PersonCard({ person, adjustments, today }: { person: Person; adjustments: DayAdjustment[]; today: number }) {
  const mine = adjustments.filter((a) => a.personId === person.id);
  const declared = mine.filter((a) => a.absentDeclared).map((a) => a.dayIndex);
  const detected = mine.filter((a) => a.absentDetected).map((a) => a.dayIndex);
  const extra = mine.filter((a) => a.extraMin > 0);
  const contributor = person.role === "contributor";

  return (
    <li className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <PersonAvatar id={person.id} name={person.name} className="size-9" />
        <div>
          <p className="font-semibold">{person.name}</p>
          <p className="text-xs text-muted-foreground">{contributor ? `Budget ${person.dailyBudgetMin} min par jour` : "Aucune tâche par défaut"}</p>
        </div>
      </div>

      {contributor && (
        <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
          <dt className="text-muted-foreground">Absences déclarées</dt>
          <dd>{days(declared)}</dd>
          <dt className="text-muted-foreground">Absences détectées</dt>
          <dd>{days(detected)}</dd>
          <dt className="text-muted-foreground">Heures exceptionnelles</dt>
          <dd>{extra.length > 0 ? extra.map((a) => `J${a.dayIndex} : +${a.extraMin} min`).join(", ") : "aucune"}</dd>
        </dl>
      )}

      {contributor && <DeclareAbsence personId={person.id} today={today} declared={declared} />}
    </li>
  );
}

const minutes = (n: number) => `${n.toLocaleString("fr-FR")} min`;

/** Who does which step, in which order: the answer to "how is the team organised". */
function OrganisationTable({ people, renfortActive }: { people: Person[]; renfortActive: boolean }) {
  const contributors = people.filter((p) => p.role === "contributor");
  const trained = (step: Step) => contributors.filter((p) => p.skills.includes(step));
  const totalLoad = STEPS.reduce((sum, step) => sum + OFFER_COUNT * DURATIONS[step], 0);
  const capacity = (p: Person) => p.dailyBudgetMin * BUSINESS_DAYS;
  const totalCapacity = contributors.reduce((sum, p) => sum + capacity(p), 0);
  const single = STEPS.filter((step) => trained(step).length === 1);
  const shared = STEPS.filter((step) => trained(step).length > 1);
  const list = (steps: readonly Step[]) =>
    steps.length <= 1 ? steps.join("") : `${steps.slice(0, -1).join(", ")} et ${steps[steps.length - 1]}`;

  const cell = (p: Person, step: Step) => {
    if (!p.skills.includes(step)) return <span className="text-muted-foreground">—</span>;
    if (step === p.majorStep) return <Badge>Tâche majeure</Badge>;
    const rank = p.priorityOrder.indexOf(step);
    return <span className="text-sm">{rank >= 0 ? `Priorité ${rank + 1}` : "Oui"}</span>;
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Étape</th>
              <th className="px-4 py-2.5 font-medium">Après</th>
              <th className="px-4 py-2.5 text-right font-medium">Charge du mois</th>
              {contributors.map((p) => (
                <th key={p.id} className="px-4 py-2.5 font-medium">
                  <span className="flex items-center gap-2 normal-case tracking-normal text-foreground">
                    <PersonAvatar id={p.id} name={p.name} className="size-6 text-[10px]" />
                    {p.name}
                  </span>
                </th>
              ))}
              {renfortActive && <th className="px-4 py-2.5 font-medium normal-case tracking-normal text-foreground">Renfort</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {STEPS.map((step) => (
              <tr key={step}>
                <td className="px-4 py-2.5">
                  <span className="font-mono font-medium">{step}</span> · {STEP_NAMES[step]}
                  <span className="block text-xs text-muted-foreground">{DURATIONS[step]} min par offre</span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{STEP_PREREQUISITES[step]}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{minutes(OFFER_COUNT * DURATIONS[step])}</td>
                {contributors.map((p) => (
                  <td key={p.id} className="px-4 py-2.5">
                    {cell(p, step)}
                  </td>
                ))}
                {renfortActive && (
                  <td className="px-4 py-2.5">
                    {step === "S1" ? <Badge variant="orange">Renfort</Badge> : <span className="text-muted-foreground">—</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-muted/30">
            <tr>
              <td className="px-4 py-2.5 font-medium" colSpan={2}>
                Total sur {BUSINESS_DAYS} jours ouvrés
              </td>
              <td className="px-4 py-2.5 text-right font-medium tabular-nums">{minutes(totalLoad)}</td>
              {contributors.map((p) => (
                <td key={p.id} className="px-4 py-2.5 tabular-nums text-muted-foreground">
                  {minutes(capacity(p))} dispo
                </td>
              ))}
              {renfortActive && <td className="px-4 py-2.5" />}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Charge totale {minutes(totalLoad)} pour {minutes(totalCapacity)} disponibles ({contributors.length} personnes × 60 min ×{" "}
        {BUSINESS_DAYS} jours), soit {minutes(totalCapacity - totalLoad)} de marge.
        {single.length > 0 && <> {list(single)} n&apos;ont chacune qu&apos;une personne formée : ce sont leurs tâches majeures.</>}
        {shared.length > 0 && <> {list(shared)}, partagées, passent après la tâche majeure.</>}
      </p>
    </div>
  );
}

function ActionRow({ action }: { action: AppliedActionView }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    const r = await cancelActionRequest(action.id);
    setBusy(false);
    if (!r.ok) setError(r.message);
  };

  const title = ACTION_TITLES[action.type as keyof typeof ACTION_TITLES] ?? action.type;
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", action.cancelled && "text-muted-foreground line-through")}>{title}</p>
        <p className="text-sm text-muted-foreground">
          {describeAction(action.type, action.params)} · appliquée à {formatSimShort(action.appliedAtSim)}
        </p>
        {error && <p role="status" className="text-sm text-danger">{error}</p>}
      </div>
      {action.cancelled ? (
        <Badge variant="outline">Annulée</Badge>
      ) : (
        <Button variant="outline" onClick={() => void cancel()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />}
          Annuler
        </Button>
      )}
    </li>
  );
}

/** E5 — L'organisation (orchestrator): who does what, absences, extra hours and applied actions. */
export function TeamScreen() {
  const team = useTeamData();
  const { state: sim } = useSimState();
  const today = businessDayOf(sim?.now_sim ?? SIM_START) ?? 1;
  const renfort = renfortFromRow(sim?.renfort_s1);

  if (team.status !== "ready") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">L&apos;organisation</h1>
        {team.status === "error" ? (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            Impossible de lire l&apos;équipe : {team.message}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
          </p>
        )}
      </section>
    );
  }

  const { people, adjustments, actions } = team.data;
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">L&apos;organisation</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Qui fait quoi, et dans quel ordre. Chacun donne 1h par jour au moment qu&apos;il choisit ; « Mes tâches » lui
          propose ses étapes dans cet ordre de priorité.
        </p>
      </div>

      <OrganisationTable people={people} renfortActive={renfort.active} />

      {/* « Renfort S1 » is no longer proposed (PM, 2026-11-11): shown only while an older one is still active. */}
      {renfort.active && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="font-medium">Renfort externe sur S1</p>
          <p className="text-muted-foreground">
            {`Actif depuis J${renfort.sinceDay ?? "?"} : l'orchestrateur fait des S1, ${renfort.budgetPerDay} min par jour (écran « Mes tâches »).`}
          </p>
        </div>
      )}

      <h2 className="text-lg font-semibold">Disponibilités</h2>
      <ul className="grid gap-3 lg:grid-cols-2">
        {people
          .filter((p) => p.role === "contributor")
          .map((p) => (
            <PersonCard key={p.id} person={p} adjustments={adjustments} today={today} />
          ))}
      </ul>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Actions appliquées</h2>
        {actions.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Aucune action appliquée pour l&apos;instant.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {actions.map((a) => (
              <ActionRow key={a.id} action={a} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
