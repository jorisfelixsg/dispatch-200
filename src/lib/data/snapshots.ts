import "server-only";

// R9 — "Un instantané est stocké à chaque changement de jour": the controls as they stand at the
// start of each business day. Secondary data: a failure is logged, never shown to the user.

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeControls } from "@/lib/engine/controls";
import { currentDay } from "@/lib/engine/state";
import type { WorldState } from "@/lib/engine/types";

export interface ControlSnapshotRow {
  day_index: number;
  at_sim: number;
  level: string;
  controls: unknown;
}

export function snapshotOf(state: WorldState): ControlSnapshotRow | null {
  const day = currentDay(state);
  if (day === null) return null;
  const report = computeControls(state);
  return { day_index: day, at_sim: state.nowSim, level: report.level, controls: report.controls };
}

export async function saveSnapshots(supabase: SupabaseClient, rows: readonly ControlSnapshotRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("control_snapshot").upsert([...rows], { onConflict: "day_index" });
  if (error) console.error(`control_snapshot: ${error.message}`);
}

export async function clearSnapshots(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.from("control_snapshot").delete().gte("day_index", 1);
  if (error) console.error(`control_snapshot: ${error.message}`);
}
