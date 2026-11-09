"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { getDefaultPerson, isPersonId } from "@/lib/engine/people";
import { formatSimShort } from "@/lib/engine/time";
import type { EngineEventType } from "@/lib/engine/types";
import { debounce, subscribeChanges } from "@/lib/live/changes";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { ACTION_TITLES, describeAction } from "@/lib/ui/actionLabels";
import { Badge } from "@/components/ui/badge";

type LoggedType = Exclude<EngineEventType, "OUT_OF_PRIORITY">;

const TYPE_LABELS: Record<LoggedType, string> = {
  STEP_DONE: "Étape faite",
  ABSENCE_DECLARED: "Absence déclarée",
  ABSENCE_DETECTED: "Absence détectée",
  ACTION_APPLIED: "Action appliquée",
  ACTION_CANCELLED: "Action annulée",
  CLOCK_CHANGED: "Horloge",
  AUTO_RUN: "Mode auto",
  RESET: "Reset",
};

const PAGE = 200;

interface EventRow {
  id: number;
  type: LoggedType;
  person_id: string | null;
  payload: Record<string, unknown>;
  at_sim: number;
  at_real: string;
}

interface OfferInfo {
  merchantName: string;
  rank: number;
}

function personName(id: unknown): string {
  return isPersonId(id) ? getDefaultPerson(id).name : "—";
}

function detail(e: EventRow, offers: Map<number, OfferInfo>): string {
  const p = e.payload;
  switch (e.type) {
    case "STEP_DONE": {
      const offer = offers.get(Number(p.offerId));
      const where = offer ? `${offer.merchantName} (rang ${offer.rank})` : `offre ${String(p.offerId)}`;
      return `${String(p.step)} · ${where}`;
    }
    case "ABSENCE_DECLARED":
      return `${personName(e.person_id)} — J${String(p.dayIndex)}`;
    case "ABSENCE_DETECTED":
      return `Absence détectée — ${personName(e.person_id)} — J${String(p.dayIndex)}`;
    case "ACTION_APPLIED":
    case "ACTION_CANCELLED": {
      const type = String(p.type);
      const title = ACTION_TITLES[type as keyof typeof ACTION_TITLES] ?? type;
      return `${title} : ${describeAction(type, (p.params ?? {}) as Record<string, unknown>)}`;
    }
    case "CLOCK_CHANGED":
      return String(p.label ?? `${formatSimShort(Number(p.from))} → ${formatSimShort(Number(p.to))}`);
    case "AUTO_RUN": {
      const days = Array.isArray(p.days) ? (p.days as number[]) : [];
      const span = days.length === 0 ? "aucun jour" : days.length === 1 ? `J${days[0]}` : `J${days[0]} à J${days[days.length - 1]}`;
      return `${span} joués : ${String(p.steps)} étapes, ${String(p.published)} / 200 publiées`;
    }
    case "RESET":
      return "Démo réinitialisée";
  }
}

function realTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** E6 — Journal: events from the most recent to the oldest, filterable by type (US-16). */
export function LogScreen() {
  const [filter, setFilter] = useState<LoggedType | "all">("all");
  const [limit, setLimit] = useState(PAGE);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offers, setOffers] = useState<Map<number, OfferInfo>>(new Map());
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const later = debounce(reload, 300);
    const unsubscribe = subscribeChanges((source) => {
      if (source === "event" || source === "poll" || source === "offer") later.run();
    });
    return () => {
      later.cancel();
      unsubscribe();
    };
  }, [reload]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      let query = supabase
        .from("event")
        .select("id, type, person_id, payload, at_sim, at_real")
        .order("id", { ascending: false })
        .limit(limit);
      if (filter !== "all") query = query.eq("type", filter);
      const [ev, of] = await Promise.all([query.returns<EventRow[]>(), supabase.from("offer").select("id, rank, merchant_name")]);
      if (cancelled) return;
      if (ev.error || of.error) {
        setError((ev.error ?? of.error)!.message);
        return;
      }
      setError(null);
      setEvents(ev.data ?? []);
      setOffers(new Map((of.data ?? []).map((o) => [o.id as number, { merchantName: o.merchant_name as string, rank: o.rank as number }])));
    })().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      cancelled = true;
    };
  }, [filter, limit, tick]);

  const rows = useMemo(() => (events ?? []).filter((e) => e.type in TYPE_LABELS), [events]);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Journal</h1>
          <p className="text-sm text-muted-foreground">Du plus récent au plus ancien.</p>
        </div>
        <label className="w-full sm:w-64">
          <span className="sr-only">Filtrer par type</span>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as LoggedType | "all");
              setLimit(PAGE);
            }}
            className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">Tous les événements</option>
            {(Object.keys(TYPE_LABELS) as LoggedType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          Impossible de lire le journal : {error}
        </p>
      )}

      {events === null && !error ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">Aucun événement.</p>
      ) : (
        <>
          <ol className="divide-y divide-border rounded-xl border border-border bg-card">
            {rows.map((e) => (
              <li key={e.id} className="grid gap-x-4 gap-y-1 px-4 py-2.5 text-sm sm:grid-cols-[7rem_10rem_6rem_minmax(0,1fr)_5rem]">
                <span className="font-mono text-xs tabular-nums">{formatSimShort(e.at_sim)}</span>
                <span className="flex items-center gap-1.5 font-medium">
                  {TYPE_LABELS[e.type]}
                  {e.type === "STEP_DONE" && e.payload.source === "auto" && <Badge variant="outline">auto</Badge>}
                </span>
                <span className="text-muted-foreground">{personName(e.person_id)}</span>
                <span className="min-w-0 break-words">{detail(e, offers)}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground sm:text-right" title="Heure réelle">
                  {realTime(e.at_real)}
                </span>
              </li>
            ))}
          </ol>
          {events && events.length >= limit && (
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="h-11 text-sm font-medium underline">
              Afficher plus
            </button>
          )}
        </>
      )}
    </section>
  );
}
