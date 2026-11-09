"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshSimState } from "@/lib/live/simState";

type Phase = "idle" | "confirm" | "running" | "done" | "error";

/** US-11 — Reset the demo, with an explicit confirmation step. */
export function ResetPanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");

  const runReset = async () => {
    setPhase("running");
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const body = (await res.json()) as { ok?: boolean; durationMs?: number; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? `Erreur ${res.status}`);
      await refreshSimState();
      setMessage(`Démo réinitialisée en ${((body.durationMs ?? 0) / 1000).toFixed(1)} s.`);
      setPhase("done");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="font-semibold">Réinitialiser la démo</h2>
        <p className="text-sm text-muted-foreground">
          Remet les 200 offres sans aucune étape faite, l&apos;horloge à J1 08:00, les compétences et priorités par
          défaut, et vide absences, actions, réservations et journal. Chaque navigateur garde son profil.
        </p>
      </div>

      {phase === "confirm" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3">
          <p className="mr-auto text-sm">Toute la progression sera effacée pour tous les participants. Confirmer ?</p>
          <Button variant="outline" onClick={() => setPhase("idle")}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={runReset}>
            Oui, réinitialiser
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setPhase("confirm")} disabled={phase === "running"}>
          <RotateCcw aria-hidden />
          {phase === "running" ? "Réinitialisation…" : "Réinitialiser la démo"}
        </Button>
      )}

      {(phase === "done" || phase === "error") && (
        <p role="status" className={phase === "done" ? "text-sm text-ok" : "text-sm text-danger"}>
          {message}
        </p>
      )}
    </div>
  );
}
