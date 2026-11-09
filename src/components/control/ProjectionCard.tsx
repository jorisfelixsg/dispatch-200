"use client";

import { useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { OFFER_COUNT } from "@/lib/engine/config";
import { formatSimShort } from "@/lib/engine/time";
import type { Projection } from "@/lib/engine/projection";
import type { ProjectionResponse } from "@/lib/live/contracts";
import { Button } from "@/components/ui/button";

/** US-17 — projection of published offers at J22, computed on demand (20 simulations). */
export function ProjectionCard() {
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
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium">Projection à J22</p>
        {projection ? (
          <p className="text-sm">
            Si l&apos;équipe continue ainsi : <span className="font-mono font-semibold tabular-nums">{projection.median}</span> offres
            publiées en médiane, <span className="font-mono font-semibold tabular-nums">{projection.min}</span> au minimum, sur{" "}
            {OFFER_COUNT}. <span className="text-muted-foreground">({projection.runs} simulations depuis {formatSimShort(projection.fromSim)})</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Simule {20} fois la fin du mois en mode auto, sur une copie de l&apos;état actuel (rien n&apos;est enregistré).
          </p>
        )}
        {error && <p role="status" className="text-sm text-danger">{error}</p>}
      </div>
      <Button variant="outline" onClick={() => void run()} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <TrendingUp aria-hidden />}
        {projection ? "Recalculer" : "Calculer"}
      </Button>
    </div>
  );
}
