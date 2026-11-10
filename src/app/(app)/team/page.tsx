import type { Metadata } from "next";
import { TeamScreen } from "@/components/team/TeamScreen";

export const metadata: Metadata = { title: "Organisation · Dispatch 200 offres" };

export default function Page() {
  return <TeamScreen />;
}
