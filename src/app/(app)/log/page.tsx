import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Journal · Dispatch 200 offres" };

export default function Page() {
  return <Placeholder title="Journal" step={7} />;
}
