"use client";

import { useSyncExternalStore } from "react";
import {
  getServerSimStateSnapshot,
  getSimStateSnapshot,
  subscribeSimState,
  type SimStateSnapshot,
} from "@/lib/live/simState";

export function useSimState(): SimStateSnapshot {
  return useSyncExternalStore(subscribeSimState, getSimStateSnapshot, getServerSimStateSnapshot);
}
