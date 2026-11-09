"use client";

import { useState } from "react";
import { CalendarArrowUp, FastForward, Plus } from "lucide-react";
import { useSimState } from "@/hooks/useSimState";
import { BUSINESS_DAYS } from "@/lib/engine/config";
import { businessDayOf, isEndOfMonth } from "@/lib/engine/clock";
import { formatSim, SIM_START } from "@/lib/engine/time";
import type { ClockAction, ClockResponse } from "@/lib/live/contracts";
import { refreshSimState } from "@/lib/live/simState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** E4 — clock controls (R13). The auto mode arrives in step 5. */
export function ClockPanel() {
  const { state } = useSimState();
  const nowSim = state?.now_sim ?? SIM_START;
  const today = businessDayOf(nowSim) ?? 1;
  const ended = isEndOfMonth(nowSim);
  const [targetDay, setTargetDay] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const days = Array.from({ length: BUSINESS_DAYS + 1 - today }, (_, i) => today + 1 + i);
  const selectedDay = targetDay !== null && targetDay > today ? targetDay : days[0];

  const move = async (action: ClockAction, day?: number) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/clock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, day }),
      });
      const body = (await res.json()) as ClockResponse;
      if (!body.ok) throw new Error(body.error);
      await refreshSimState();
      setMessage({ ok: true, text: body.changed ? `Horloge : ${formatSim(body.nowSim)}` : "L'horloge est déjà à la fin du mois." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const locked = busy || ended || Boolean(state?.auto_running);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="font-semibold">Horloge partagée</h2>
        <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">{formatSim(nowSim)}</p>
        {ended && <p className="mt-1 font-medium text-warn">Fin du mois</p>}
        <p className="mt-1 text-sm text-muted-foreground">
          Au-delà de 19:00, l&apos;horloge passe au jour ouvré suivant à 08:00. Elle ne recule jamais, sauf par un reset.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void move("plus1h")} disabled={locked}>
          <Plus aria-hidden /> 1h
        </Button>
        <Button variant="outline" onClick={() => void move("plus2h")} disabled={locked}>
          <Plus aria-hidden /> 2h
        </Button>
        <Button onClick={() => void move("nextDay")} disabled={locked}>
          <FastForward aria-hidden /> Jour suivant
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="target-day" className="text-sm font-medium">
          Aller au début de
        </label>
        <select
          id="target-day"
          value={selectedDay ?? ""}
          onChange={(e) => setTargetDay(Number(e.target.value))}
          disabled={locked || days.length === 0}
          className="h-11 rounded-md border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {days.map((d) => (
            <option key={d} value={d}>
              {d > BUSINESS_DAYS ? `J${d} (fin du mois)` : `J${d}`}
            </option>
          ))}
        </select>
        <Button variant="outline" onClick={() => selectedDay && void move("goToDay", selectedDay)} disabled={locked || !selectedDay}>
          <CalendarArrowUp aria-hidden /> Aller
        </Button>
      </div>

      {state?.auto_running && <p className="text-sm font-medium text-warn">Simulation en cours : l&apos;horloge est verrouillée.</p>}
      {message && (
        <p role="status" className={cn("text-sm", message.ok ? "text-ok" : "text-danger")}>
          {message.text}
        </p>
      )}
    </div>
  );
}
