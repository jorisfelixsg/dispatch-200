import type { Metadata } from "next";
import { AutoPanel } from "@/components/clock/AutoPanel";
import { ClockPanel } from "@/components/clock/ClockPanel";
import { ResetPanel } from "@/components/clock/ResetPanel";

export const metadata: Metadata = { title: "Horloge et simulation · Dispatch 200 offres" };

export default function Page() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Horloge et simulation</h1>
      <ClockPanel />
      <AutoPanel />
      <ResetPanel />
    </section>
  );
}
