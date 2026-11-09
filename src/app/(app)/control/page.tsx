import type { Metadata } from "next";
import { ControlScreen } from "@/components/control/ControlScreen";

export const metadata: Metadata = { title: "Tour de contrôle · Dispatch 200 offres" };

export default function Page() {
  return <ControlScreen />;
}
