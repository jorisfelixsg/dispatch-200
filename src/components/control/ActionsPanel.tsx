"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ActionProposal } from "@/lib/engine/actions";
import { BUSINESS_DAYS } from "@/lib/engine/config";
import type { ControlResult } from "@/lib/engine/controls";
import { getDefaultPerson, type PersonId } from "@/lib/engine/people";
import type { ActionPreview, ControlPayload } from "@/lib/live/contracts";
import { applyActionRequest, cancelActionRequest, previewActionRequest } from "@/lib/live/actionsClient";
import { ACTION_TITLES, describeAction } from "@/lib/ui/actionLabels";
import { actionEffect, actionTitle, controlTarget, EFFECT_TAG_LABEL, worstControl, type EffectTag } from "@/lib/ui/towerText";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CONTRIBUTORS: PersonId[] = ["alice", "bob", "charlie"];

const TAG_CLASS: Record<EffectTag, string> = {
  fix: "bg-ok text-white",
  better: "bg-ok/15 text-ok",
  none: "bg-muted text-muted-foreground",
};

const selectClass =
  "h-9 rounded-md border border-border bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ActionRow({ index, proposal, payload, worst }: { index: number; proposal: ActionProposal; payload: ControlPayload; worst: ControlResult }) {
  const [personId, setPersonId] = useState<PersonId | "">(proposal.personId ?? "");
  const [day, setDay] = useState<number | null>(proposal.dayIndex);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const today = payload.today ?? 1;
  const needsPerson = proposal.type === "EXTRA_HOUR";
  // PM decision: no extra hour on a day the chosen person is declared absent.
  const days = Array.from({ length: BUSINESS_DAYS - today + 1 }, (_, i) => today + i).filter(
    (d) => !payload.declaredAbsences.some((a) => a.personId === personId && a.dayIndex === d),
  );
  const selectedDay = day !== null && days.includes(day) ? day : (days[0] ?? null);
  const alreadyActive = proposal.type === "RENFORT_S1" && payload.renfortActive;
  const ready = !alreadyActive && !(needsPerson && personId === "") && !(needsPerson && selectedDay === null);

  // US-18 — impact preview, refreshed when the parameters or the state change.
  const [preview, setPreview] = useState<ActionPreview | null>(null);
  const previewKey = `${proposal.type}|${personId}|${needsPerson ? selectedDay : ""}|${payload.nowSim}|${payload.controls.map((c) => c.margin).join(",")}`;
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void previewActionRequest(proposal.type, needsPerson ? personId || null : null, needsPerson ? selectedDay : null).then((p) => {
        if (!cancelled) setPreview(p);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previewKey sums up the inputs
  }, [previewKey, ready]);

  const effect =
    ready && preview
      ? actionEffect(
          proposal.type,
          worst,
          preview.changes.find((c) => c.controlId === worst.id)?.marginAfter ?? worst.margin,
          preview.levelBefore,
          preview.levelAfter,
          personId || null,
        )
      : null;
  const helps = effect !== null && effect.tag !== "none";

  const apply = async () => {
    setBusy(true);
    setMessage(null);
    const r = await applyActionRequest(proposal.type, needsPerson ? personId || null : null, needsPerson ? selectedDay : null);
    setBusy(false);
    setMessage(r.ok ? { ok: true, text: "Action appliquée : tout est recalculé." } : { ok: false, text: r.message });
  };

  return (
    <li
      className={cn(
        "grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-3 rounded-xl border p-3 md:grid-cols-[1.75rem_minmax(0,1fr)_auto]",
        helps ? "border-2 border-ok bg-ok/10 py-4" : "border-border",
      )}
    >
      <span
        className={cn("flex size-7 items-center justify-center rounded-full font-mono text-xs", helps ? "bg-ok text-white" : "bg-muted")}
        aria-hidden
      >
        {index}
      </span>
      <div className="min-w-0 space-y-1">
        <p className={cn("font-medium", helps && "text-base font-semibold md:text-lg")}>
          {actionTitle(proposal.type, needsPerson ? personId || null : null)}
          {effect && (
            <span className={cn("ml-2 inline-block rounded px-1.5 py-0.5 align-[2px] text-[11px] font-bold uppercase tracking-wide", TAG_CLASS[effect.tag])}>
              {EFFECT_TAG_LABEL[effect.tag]}
            </span>
          )}
        </p>
        <p className={cn("text-sm", helps ? "text-foreground" : "text-muted-foreground")}>
          {alreadyActive
            ? "Déjà en place."
            : effect
              ? effect.text
              : needsPerson && personId === ""
                ? "Choisis la personne pour voir l'effet."
                : "Calcul de l'effet…"}
        </p>
        {message && (
          <p role="status" className={cn("text-sm", message.ok ? "text-ok" : "text-danger")}>
            {message.text}
          </p>
        )}
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-2 md:col-start-3 md:justify-end">
        {needsPerson && proposal.personId === null && (
          <select aria-label="Personne" value={personId} onChange={(e) => setPersonId(e.target.value as PersonId)} className={selectClass}>
            <option value="" disabled>
              Qui ?
            </option>
            {CONTRIBUTORS.map((id) => (
              <option key={id} value={id}>
                {getDefaultPerson(id).name}
              </option>
            ))}
          </select>
        )}
        {needsPerson && (
          <select
            aria-label="Jour"
            value={selectedDay ?? ""}
            onChange={(e) => setDay(Number(e.target.value))}
            className={selectClass}
            disabled={days.length === 0}
          >
            {days.map((d) => (
              <option key={d} value={d}>
                J{d}
                {d === today ? " (aujourd'hui)" : ""}
              </option>
            ))}
          </select>
        )}
        <Button size="sm" variant={helps ? "default" : "outline"} onClick={() => void apply()} disabled={busy || !ready}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {alreadyActive ? "Déjà en place" : "Appliquer"}
        </Button>
      </div>
    </li>
  );
}

function ActiveActions({ payload }: { payload: ControlPayload }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (payload.activeActions.length === 0) return <p className="text-sm text-muted-foreground">Déjà en place : aucune action.</p>;

  const cancel = async (id: number) => {
    setBusyId(id);
    setError(null);
    const r = await cancelActionRequest(id);
    setBusyId(null);
    if (!r.ok) setError(r.message);
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-sm font-medium">Déjà en place</p>
      <ul className="space-y-2">
        {payload.activeActions.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <b className="font-medium">{ACTION_TITLES[a.type]}</b> <span className="text-muted-foreground">· {describeAction(a.type, a.params)}</span>
            </span>
            <Button size="sm" variant="outline" onClick={() => void cancel(a.id)} disabled={busyId !== null}>
              {busyId === a.id && <Loader2 className="animate-spin" aria-hidden />}
              Annuler
            </Button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="status" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** R11 / US-10 — « Que faire ? »: catch-up actions (R11 order), each with its effect in plain words (US-18). */
export function ActionsPanel({ payload }: { payload: ControlPayload }) {
  const found = worstControl(payload.controls);
  // Proposals exist only when the level is orange or red (R11).
  const worst = payload.proposals.length > 0 ? found : null;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{worst ? `Que faire pour ${controlTarget(worst.id)} ?` : "Que faire ?"}</h2>
        {worst && <span className="text-xs text-muted-foreground">Effet de chaque action calculé en direct</span>}
      </div>
      {!worst ? (
        <p className="text-sm text-muted-foreground">Rien pour l&apos;instant : tout est dans les temps, aucune action n&apos;est proposée.</p>
      ) : (
        <ol className="space-y-2">
          {payload.proposals.map((p, i) => (
            <ActionRow key={`${p.type}:${p.personId ?? ""}:${p.dayIndex ?? ""}`} index={i + 1} proposal={p} payload={payload} worst={worst} />
          ))}
        </ol>
      )}
      <ActiveActions payload={payload} />
    </section>
  );
}
