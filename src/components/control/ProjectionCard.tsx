"use client";

import { useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { OFFER_COUNT } from "@/lib/engine/config";
import { formatSimShort } from "@/lib/engine/time";
import type { Projection } from "@/lib/engine/projection";
import type { ProjectionResponse } from "@/lib/live/contracts";
import { Button } from "@/components/ui/button";

/** US-17 — projection of published offers at J22, computed on demand (20 simulations). Compact, for the hero banner. */
export function ProjectionKpi() {
  const [busy, setBusy] = useState(false);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projection", { cache: "no-store" });
      const body = (await res.json()) as ProjectionResponse;
      if (!body.ok) throw new Error(body.error);
      setProjection(body.projection);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid content-start gap-1">
      <span className="text-xs text-muted-foreground">Prévision au J22, si rien ne change</span>
      {projection ? (
        <p
          className="font-mono text-2xl font-semibold tabular-nums"
          title={`${projection.runs} simulations depuis ${formatSimShort(projection.fromSim)}`}
        >
          ≈ {projection.median}
          <span className="text-sm font-normal text-muted-foreground"> / {OFFER_COUNT} · au pire {projection.min}</span>
        </p>
      ) : null}
      <Button variant="outline" size="sm" onClick={() => void run()} disabled={busy} className="w-fit">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <TrendingUp aria-hidden />}
        {projection ? "Recalculer" : "Calculer"}
      </Button>
      {error && (
        <p role="status" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
