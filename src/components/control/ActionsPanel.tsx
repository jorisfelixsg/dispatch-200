"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleCheck, Loader2, MessageCircle, X } from "lucide-react";
import type { ActionProposal } from "@/lib/engine/actions";
import { BUSINESS_DAYS } from "@/lib/engine/config";
import type { ControlResult } from "@/lib/engine/controls";
import { getDefaultPerson, type PersonId } from "@/lib/engine/people";
import type { ActionPreview, ControlPayload } from "@/lib/live/contracts";
import { applyActionRequest, cancelActionRequest, previewActionRequest } from "@/lib/live/actionsClient";
import { ACTION_TITLES, describeAction } from "@/lib/ui/actionLabels";
import {
  actionEffect,
  actionTitle,
  appliedNote,
  askFirstNote,
  controlTarget,
  EFFECT_TAG_LABEL,
  levelNowNote,
  worstControl,
  type EffectTag,
} from "@/lib/ui/towerText";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CONTRIBUTORS: PersonId[] = ["alice", "bob", "charlie"];

const TAG_CLASS: Record<EffectTag, string> = {
  fix: "bg-ok text-white",
  better: "bg-ok/15 text-ok",
  none: "bg-muted text-muted-foreground",
};

const DOT_CLASS: Record<EffectTag, string> = {
  fix: "bg-ok",
  better: "bg-ok/50",
  none: "bg-muted-foreground/40",
};

const selectClass =
  "h-9 rounded-md border border-border bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const NO_PERSON = "none";

function ActionRow({
  proposal,
  payload,
  worst,
  tagKey,
  folded,
  onApplied,
  onTag,
}: {
  proposal: ActionProposal;
  payload: ControlPayload;
  worst: ControlResult;
  tagKey: string;
  /** Hidden behind « Voir les actions sans effet » (no effect on the worst step). */
  folded: boolean;
  onApplied: (note: string) => void;
  /** Effect tag reported to the panel; null once the stand-in changed the inputs (the row then stays visible). */
  onTag: (key: string, tag: EffectTag | null) => void;
}) {
  const [personId, setPersonIdRaw] = useState<PersonId | "">(proposal.personId ?? "");
  const [day, setDayRaw] = useState<number | null>(proposal.dayIndex);
  const [touched, setTouched] = useState(false);
  const setPersonId = (id: PersonId) => {
    setTouched(true);
    setPersonIdRaw(id);
  };
  const setDay = (d: number) => {
    setTouched(true);
    setDayRaw(d);
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = payload.today ?? 1;
  const needsPerson = proposal.type === "EXTRA_HOUR";
  // Several people can do the worst step: each one is offered with the effect of their extra hour,
  // so the stand-in picks with the figures in front of them. Nothing is pre-selected (R11 unchanged).
  const choosePerson = needsPerson && proposal.personId === null;
  const absentOn = (id: PersonId | "", d: number) => payload.declaredAbsences.some((a) => a.personId === id && a.dayIndex === d);
  // PM decision: no extra hour on a day the chosen person is declared absent.
  const days = Array.from({ length: BUSINESS_DAYS - today + 1 }, (_, i) => today + i).filter((d) => !absentOn(personId, d));
  const selectedDay = day !== null && days.includes(day) ? day : (days[0] ?? null);
  const alreadyActive = proposal.type === "RENFORT_S1" && payload.renfortActive;
  const ready = !alreadyActive && !(needsPerson && personId === "") && !(needsPerson && selectedDay === null);

  // US-18 — impact preview of each candidate (nothing is written), refreshed when the inputs or the state change.
  const candidates: (PersonId | null)[] = !needsPerson ? [null] : choosePerson ? CONTRIBUTORS : [proposal.personId];
  const canPreview = !alreadyActive && (!needsPerson || selectedDay !== null);
  const [previews, setPreviews] = useState<Record<string, ActionPreview | null>>({});
  const previewKey = `${proposal.type}|${candidates.join(",")}|${needsPerson ? selectedDay : ""}|${payload.nowSim}|${payload.controls.map((c) => c.margin).join(",")}`;
  useEffect(() => {
    if (!canPreview) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const asked = candidates.filter((id) => !(id && selectedDay !== null && absentOn(id, selectedDay)));
      void Promise.all(
        asked.map((id) => previewActionRequest(proposal.type, id, needsPerson ? selectedDay : null).then((p) => [id ?? NO_PERSON, p] as const)),
      ).then((entries) => {
        if (!cancelled) setPreviews(Object.fromEntries(entries));
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previewKey sums up the inputs
  }, [previewKey, canPreview]);

  const effectFor = (id: PersonId | null) => {
    const preview = canPreview ? previews[id ?? NO_PERSON] : null;
    if (!preview) return null;
    const marginAfter = preview.changes.find((c) => c.controlId === worst.id)?.marginAfter ?? worst.margin;
    return actionEffect(proposal.type, worst, marginAfter, preview.levelBefore, preview.levelAfter, id);
  };
  const effect = !needsPerson ? effectFor(null) : personId !== "" ? effectFor(personId) : null;
  const helps = effect !== null && effect.tag !== "none";
  const reported = touched ? null : alreadyActive ? "none" : (effect?.tag ?? null);
  useEffect(() => onTag(tagKey, reported), [tagKey, reported, onTag]);

  const apply = async () => {
    setBusy(true);
    setError(null);
    const who = needsPerson ? personId || null : null;
    const when = needsPerson ? selectedDay : null;
    const r = await applyActionRequest(proposal.type, who, when);
    setBusy(false);
    if (r.ok) onApplied(appliedNote(proposal.type, who, when));
    else setError(r.message);
  };

  return (
    <li
      className={cn(
        "grid grid-cols-1 items-center gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_auto]",
        helps ? "border-2 border-ok bg-ok/10 py-4" : "border-border",
        folded && "hidden",
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {effect && (
          <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-semibold", TAG_CLASS[effect.tag])}>{EFFECT_TAG_LABEL[effect.tag]}</span>
        )}
        <p className={cn("font-medium", helps && "text-base font-semibold md:text-lg")}>
          {actionTitle(proposal.type, needsPerson ? personId || null : null)}
        </p>
        <p className={cn("text-sm", helps ? "text-foreground" : "text-muted-foreground")}>
          {alreadyActive
            ? "Déjà en place."
            : effect
              ? effect.text
              : choosePerson && personId === ""
                ? "Choisir la personne : l'effet de son heure en plus est indiqué pour chacune."
                : "Calcul de l'effet…"}
        </p>
        {choosePerson && !alreadyActive && (
          <div role="radiogroup" aria-label="Personne" className="flex flex-wrap gap-2 pt-1">
            {CONTRIBUTORS.map((id) => {
              const absent = selectedDay !== null && absentOn(id, selectedDay);
              const e = absent ? null : effectFor(id);
              const selected = personId === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={absent}
                  onClick={() => setPersonId(id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                    selected ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted",
                  )}
                >
                  <span className={cn("size-2 shrink-0 rounded-full", e ? DOT_CLASS[e.tag] : "bg-border")} aria-hidden />
                  <span className="font-medium">{getDefaultPerson(id).name}</span>
                  <span className="text-muted-foreground">
                    {absent ? "absence ce jour-là" : e ? EFFECT_TAG_LABEL[e.tag].toLowerCase() : "calcul…"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {needsPerson && personId !== "" && selectedDay !== null && !alreadyActive && (
          <p className="flex items-start gap-1.5 text-sm text-foreground">
            <MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            {askFirstNote(personId, selectedDay)}
          </p>
        )}
        {error && (
          <p role="status" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
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
  // Kept at panel level: after « Appliquer » the rows are recalculated (and vanish when the level turns green).
  const [applied, setApplied] = useState<string | null>(null);
  // Actions without effect on the worst step are folded, so « Que faire ? » does not invite useless clicks.
  const [tags, setTags] = useState<Record<string, EffectTag | null>>({});
  const [showOthers, setShowOthers] = useState(false);
  const reportTag = useCallback(
    (key: string, tag: EffectTag | null) => setTags((t) => (t[key] === tag ? t : { ...t, [key]: tag })),
    [],
  );
  const keyOf = (p: ActionProposal) => `${p.type}:${p.personId ?? ""}:${p.dayIndex ?? ""}`;
  const keys = payload.proposals.map(keyOf);
  const noEffect = keys.filter((k) => tags[k] === "none");
  const nothingHelps = keys.length > 0 && noEffect.length === keys.length;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{worst ? `Que faire pour ${controlTarget(worst.id)} ?` : "Que faire ?"}</h2>
        {worst && <span className="text-xs text-muted-foreground">Effet de chaque action calculé en direct</span>}
      </div>
      {applied && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-border bg-muted/60 p-3 text-sm">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-medium">{applied}</p>
            <p className="text-muted-foreground">{levelNowNote(payload.level)}</p>
          </div>
          <button
            type="button"
            onClick={() => setApplied(null)}
            aria-label="Masquer ce message"
            className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
      {!worst ? (
        !applied && (
          <p className="text-sm text-muted-foreground">
            {payload.indicators.endOfMonth
              ? "Le mois est terminé : plus aucune action n'est possible."
              : "Rien pour l'instant : tout est dans les temps, aucune action n'est proposée."}
          </p>
        )
      ) : (
        <>
          {nothingHelps && (
            <p className="text-sm font-medium">Aucune action proposée ne comble ce manque.</p>
          )}
          <ol className="space-y-2">
            {payload.proposals.map((p) => (
              <ActionRow
                key={keyOf(p)}
                tagKey={keyOf(p)}
                proposal={p}
                payload={payload}
                worst={worst}
                folded={!showOthers && tags[keyOf(p)] === "none"}
                onApplied={setApplied}
                onTag={reportTag}
              />
            ))}
          </ol>
          {noEffect.length > 0 && (
            <button
              type="button"
              onClick={() => setShowOthers((v) => !v)}
              aria-expanded={showOthers}
              className="w-fit rounded text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showOthers ? "Masquer" : "Voir"} les actions sans effet sur ce manque ({noEffect.length})
            </button>
          )}
        </>
      )}
      <ActiveActions payload={payload} />
    </section>
  );
}
