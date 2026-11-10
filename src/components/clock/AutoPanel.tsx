"use client";

import { useState } from "react";
import { Loader2, SkipForward } from "lucide-react";
import { useSimState } from "@/hooks/useSimState";
import { BUSINESS_DAYS } from "@/lib/engine/config";
import { REFERENCE_SEED } from "@/lib/engine/autoplay";
import { businessDayOf, isEndOfMonth } from "@/lib/engine/clock";
import { formatSimShort, SIM_START } from "@/lib/engine/time";
import type { AutoResponse } from "@/lib/live/contracts";
import { refreshSimState } from "@/lib/live/simState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function daysLabel(days: number[]): string {
  if (days.length === 0) return "Aucun jour joué";
  if (days.length === 1) return `J${days[0]} joué`;
  return `J${days[0]} à J${days[days.length - 1]} joués`;
}

/**
 * E4 — auto mode (R14). PM decision (2026-11-09): only « Jouer jusqu'au début de Jx » is shown;
 * the seed is fixed (REFERENCE_SEED) and not exposed in the UI.
 */
export function AutoPanel() {
  const { state } = useSimState();
  const nowSim = state?.now_sim ?? SIM_START;
  const today = businessDayOf(nowSim) ?? 1;
  const ended = isEndOfMonth(nowSim);
  const running = Boolean(state?.auto_running);

  const [targetDay, setTargetDay] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const days = Array.from({ length: BUSINESS_DAYS + 1 - today }, (_, i) => today + 1 + i);
  const selectedDay = targetDay !== null && targetDay > today ? targetDay : days[days.length - 1];
  const reference = state?.reference_curve ?? null;

  const play = async (day: number) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "untilDay", day, seed: REFERENCE_SEED }),
      });
      const body = (await res.json()) as AutoResponse;
      if (!body.ok) throw new Error(body.error);
      await refreshSimState();
      const last = body.lastPublication !== null ? ` Dernière publication : ${formatSimShort(body.lastPublication)}.` : "";
      setMessage({
        ok: true,
        text: `${daysLabel(body.daysPlayed)} : ${body.steps} étapes faites, ${body.published} / 200 publiées.${last}`,
      });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const locked = busy || running || ended;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="font-semibold">Mode auto</h2>
        <p className="text-sm text-muted-foreground">
          Simule les journées à la place des contributeurs : chacun se connecte une fois par jour et fait sa liste
          dans l&apos;ordre jusqu&apos;à épuiser son budget. Rejouer depuis le même état donne toujours le même résultat.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="auto-day" className="text-sm font-medium">
          Jouer jusqu&apos;au début de
        </label>
        <select
          id="auto-day"
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
        <Button onClick={() => selectedDay && void play(selectedDay)} disabled={locked || !selectedDay}>
          <SkipForward aria-hidden /> Jouer
        </Button>
      </div>

      {(busy || running) && (
        <p role="status" className="flex items-center gap-2 text-sm font-medium text-warn">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Simulation en cours : les boutons « Fait » et l&apos;horloge sont verrouillés.
        </p>
      )}
      {ended && <p className="text-sm text-muted-foreground">Fin du mois : il n&apos;y a plus de jour à jouer.</p>}
      {message && (
        <p role="status" className={cn("text-sm", message.ok ? "text-ok" : "text-danger")}>
          {message.text}
        </p>
      )}

      <p className="border-t border-border pt-3 text-xs text-muted-foreground">
        {reference && reference.length > 0
          ? `Trajectoire de référence (calculée au reset) : ${reference[reference.length - 1]} / 200 publiées à J${reference.length}. La courbe est affichée dans la tour de contrôle.`
          : "Trajectoire de référence absente : clique sur « Réinitialiser la démo » pour la calculer."}
      </p>
    </div>
  );
}
