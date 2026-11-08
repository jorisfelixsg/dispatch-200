"use client";

import { SIM_START } from "@/lib/engine/time";

/**
 * Shared simulated clock.
 * Step 1: the clock is not stored yet, so it shows the initial value J1 08:00.
 * Step 2 reads `sim_state.now_sim` from Supabase; step 4 subscribes to Realtime.
 */
export function useSimClock(): { nowSim: number; live: boolean } {
  return { nowSim: SIM_START, live: false };
}
