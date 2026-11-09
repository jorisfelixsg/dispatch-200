import type { Metadata } from "next";
import { ResetPanel } from "@/components/clock/ResetPanel";

export const metadata: Metadata = { title: "Horloge et simulation · Dispatch 200 offres" };

export default function Page() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Horloge et simulation</h1>
      <div className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
        Les commandes d&apos;horloge (+1h, +2h, jour suivant) arrivent à l&apos;étape 4, le mode auto à l&apos;étape 5.
      </div>
      <ResetPanel />
    </section>
  );
}
