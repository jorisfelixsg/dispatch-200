"use client";

import { useSyncExternalStore } from "react";
import { getControlSnapshot, getServerControlSnapshot, subscribeControlReport } from "@/lib/live/controlReport";

/** Live control-tower report (controls, levels, indicators, curves). */
export function useControlReport() {
  return useSyncExternalStore(subscribeControlReport, getControlSnapshot, getServerControlSnapshot);
}
