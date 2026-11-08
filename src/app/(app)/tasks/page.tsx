import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Mes tâches · Dispatch 200 offres" };

export default function Page() {
  return <Placeholder title="Mes tâches" step={4} />;
}
