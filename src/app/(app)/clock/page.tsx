import type { Metadata } from "next";
import { ClockPanel } from "@/components/clock/ClockPanel";
import { ResetPanel } from "@/components/clock/ResetPanel";

export const metadata: Metadata = { title: "Horloge et simulation · Dispatch 200 offres" };

export default function Page() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Horloge et simulation</h1>
      <ClockPanel />
      <div className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
        Le mode auto (« Jouer la journée en cours », « Jouer jusqu&apos;au début de Jx », graine) arrive à l&apos;étape 5.
      </div>
      <ResetPanel />
    </section>
  );
}
