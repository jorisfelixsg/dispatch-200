"use client";

import { useState } from "react";
import { Loader2, Play, SkipForward } from "lucide-react";
import { useSimState } from "@/hooks/useSimState";
import { BUSINESS_DAYS } from "@/lib/engine/config";
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

/** E4 — auto mode (R14) with its seed, and the reference trajectory computed at reset (R15). */
export function AutoPanel() {
  const { state } = useSimState();
  const nowSim = state?.now_sim ?? SIM_START;
  const today = businessDayOf(nowSim) ?? 1;
  const ended = isEndOfMonth(nowSim);
  const running = Boolean(state?.auto_running);

  const [seedText, setSeedText] = useState<string | null>(null);
  const [targetDay, setTargetDay] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const seedValue = seedText ?? String(state?.seed ?? 42);
  const seed = /^\d+$/.test(seedValue) ? Number(seedValue) : null;
  const days = Array.from({ length: BUSINESS_DAYS + 1 - today }, (_, i) => today + 1 + i);
  const selectedDay = targetDay !== null && targetDay > today ? targetDay : days[days.length - 1];
  const reference = state?.reference_curve ?? null;

  const play = async (mode: "day" | "untilDay", day?: number) => {
    if (seed === null) {
      setMessage({ ok: false, text: "La graine doit être un entier positif." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, day, seed }),
      });
      const body = (await res.json()) as AutoResponse;
      if (!body.ok) throw new Error(body.error);
      await refreshSimState();
      setSeedText(null);
      const last = body.lastPublication !== null ? ` Dernière publication : ${formatSimShort(body.lastPublication)}.` : "";
      setMessage({
        ok: true,
        text:
          `${daysLabel(body.daysPlayed)} (graine ${body.seed}) : ${body.steps} étapes faites, ` +
          `${body.published} / 200 publiées.${last} Calcul en ${(body.durationMs / 1000).toFixed(1).replace(".", ",")} s.`,
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
          Chaque contributeur qui a du budget se connecte une fois par jour, à une heure tirée au hasard (entre
          l&apos;heure actuelle et 18:00), et fait sa liste dans l&apos;ordre jusqu&apos;à épuiser son budget. Même
          graine et même état de départ : même résultat.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="auto-seed" className="text-sm font-medium">
          Graine
        </label>
        <input
          id="auto-seed"
          inputMode="numeric"
          value={seedValue}
          onChange={(e) => setSeedText(e.target.value.trim())}
          disabled={locked}
          className={cn(
            "h-11 w-28 rounded-md border bg-card px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            seed === null ? "border-danger" : "border-border",
          )}
        />
        <Button onClick={() => void play("day")} disabled={locked || seed === null}>
          <Play aria-hidden /> Jouer la journée en cours
        </Button>
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
        <Button variant="outline" onClick={() => selectedDay && void play("untilDay", selectedDay)} disabled={locked || !selectedDay || seed === null}>
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
          ? `Trajectoire de référence (calculée au reset, graine 42) : ${reference[reference.length - 1]} / 200 publiées à J${reference.length}. La courbe s'affichera dans la tour de contrôle (étape 6).`
          : "Trajectoire de référence absente : clique sur « Réinitialiser la démo » pour la calculer."}
      </p>
    </div>
  );
}
