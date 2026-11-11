"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { OFFER_COUNT } from "@/lib/engine/config";
import { formatSimShort } from "@/lib/engine/time";
import type { Projection } from "@/lib/engine/projection";
import type { ProjectionResponse } from "@/lib/live/contracts";
import { safetyMarginNote } from "@/lib/ui/towerText";

/**
 * US-17 — projection of published offers at J22 (20 simulations). Computed automatically when the
 * tower opens and again after each change of the state (PM, 2026-11-11). Compact, for the hero banner.
 */
export function ProjectionKpi({ stateKey, safetyDeadline }: { stateKey: string; safetyDeadline: number | null }) {
  const [busy, setBusy] = useState(true);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Short wait so that a burst of changes (a simulated day) triggers one calculation only.
    const timer = window.setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch("/api/projection", { cache: "no-store" });
        const body = (await res.json()) as ProjectionResponse;
        if (!body.ok) throw new Error(body.error);
        if (!cancelled) {
          setProjection(body.projection);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [stateKey]);

  const note = projection ? safetyMarginNote(safetyDeadline, projection.median, OFFER_COUNT) : null;

  return (
    <div className="grid content-start gap-1">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Prévision au J22, si rien ne change
        {busy && projection && <Loader2 className="size-3 animate-spin" aria-label="Calcul en cours" />}
      </span>
      {projection ? (
        <p
          className="font-mono text-2xl font-semibold tabular-nums"
          title={`${projection.runs} simulations depuis ${formatSimShort(projection.fromSim)}`}
        >
          ≈ {projection.median}
          <span className="text-sm font-normal text-muted-foreground"> / {OFFER_COUNT} · au pire {projection.min}</span>
        </p>
      ) : (
        !error && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Calcul…
          </p>
        )
      )}
      {note && <p className="max-w-64 text-xs">{note}</p>}
      {error && (
        <p role="status" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
