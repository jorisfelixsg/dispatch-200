import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Horloge et simulation · Dispatch 200 offres" };

export default function Page() {
  return <Placeholder title="Horloge et simulation" step={4} />;
}
