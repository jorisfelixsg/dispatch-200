import type { Metadata } from "next";
import { AutoPanel } from "@/components/clock/AutoPanel";
import { ClockPanel } from "@/components/clock/ClockPanel";
import { ResetPanel } from "@/components/clock/ResetPanel";

export const metadata: Metadata = { title: "Simulation · Dispatch 200 offres" };

/** E4 — demo scaffolding: shared clock, auto mode and reset. Not part of the real tool. */
export default function Page() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">Simulation</h1>
          <span className="rounded border border-dashed border-muted-foreground/50 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Démo uniquement
          </span>
        </div>
        <p className="max-w-3xl rounded-xl border border-dashed border-muted-foreground/40 bg-card p-4 text-sm text-muted-foreground">
          Cet écran n&apos;existe que pour la démo. Dans la réalité, le temps passe tout seul et chacun se connecte au
          moment qu&apos;il choisit. Ici, l&apos;orchestrateur fait avancer l&apos;horloge partagée, joue des journées
          entières en mode auto et réinitialise la démo. Les éléments en pointillés appartiennent à la simulation.
        </p>
      </div>
      <ClockPanel />
      <AutoPanel />
      <ResetPanel />
    </section>
  );
}
