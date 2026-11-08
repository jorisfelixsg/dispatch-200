import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Suivi des offres · Dispatch 200 offres" };

export default function Page() {
  return <Placeholder title="Suivi des offres" step={2} />;
}
