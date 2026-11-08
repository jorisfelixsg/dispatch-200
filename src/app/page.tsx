import type { Metadata } from "next";
import { HomeScreen } from "@/components/HomeScreen";

export const metadata: Metadata = { title: "Accueil · Dispatch 200 offres" };

export default function Page() {
  return <HomeScreen />;
}
