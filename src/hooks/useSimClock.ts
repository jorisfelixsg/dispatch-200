"use client";

import { SIM_START } from "@/lib/engine/time";
import { useSimState } from "./useSimState";

/** Shared simulated clock (sim_state.now_sim). Falls back to J1 08:00 before the first read. */
export function useSimClock(): { nowSim: number; live: boolean } {
  const { state } = useSimState();
  return { nowSim: state?.now_sim ?? SIM_START, live: state !== null };
}
