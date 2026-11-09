import type { Metadata } from "next";
import { OffersScreen } from "@/components/offers/OffersScreen";

export const metadata: Metadata = { title: "Suivi des offres · Dispatch 200 offres" };

export default function Page() {
  return <OffersScreen />;
}
