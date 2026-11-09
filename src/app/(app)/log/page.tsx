import type { Metadata } from "next";
import { LogScreen } from "@/components/log/LogScreen";

export const metadata: Metadata = { title: "Journal · Dispatch 200 offres" };

export default function Page() {
  return <LogScreen />;
}
