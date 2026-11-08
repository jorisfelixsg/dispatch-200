import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Tour de contrôle · Dispatch 200 offres" };

export default function Page() {
  return <Placeholder title="Tour de contrôle" step={6} />;
}
