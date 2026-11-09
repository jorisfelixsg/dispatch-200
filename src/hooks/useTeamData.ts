"use client";

import { useCallback, useEffect, useState } from "react";
import { adjustmentFromRow, personFromRow, type DayAdjustmentRow, type PersonRow } from "@/lib/data/rows";
import type { DayAdjustment, Person } from "@/lib/engine/types";
import { debounce, subscribeChanges } from "@/lib/live/changes";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export interface AppliedActionView {
  id: number;
  type: string;
  params: Record<string, unknown>;
  appliedAtSim: number;
  cancelled: boolean;
}

export interface TeamData {
  people: Person[];
  adjustments: DayAdjustment[];
  actions: AppliedActionView[];
}

export type TeamState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: TeamData };

/** E5 — people, day adjustments and applied actions (anon read), refreshed on every change. */
export function useTeamData(): TeamState {
  const [state, setState] = useState<TeamState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const later = debounce(reload, 200);
    const unsubscribe = subscribeChanges((source) => {
      if (source !== "step_execution" && source !== "offer" && source !== "event") later.run();
    });
    return () => {
      later.cancel();
      unsubscribe();
    };
  }, [reload]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const [people, adjustments, actions] = await Promise.all([
        supabase.from("person").select("*").order("sort_order").returns<PersonRow[]>(),
        supabase.from("day_adjustment").select("*").order("day_index").returns<DayAdjustmentRow[]>(),
        supabase.from("applied_action").select("id, type, params, applied_at_sim, cancelled").order("id", { ascending: false }),
      ]);
      if (cancelled) return;
      const error = people.error ?? adjustments.error ?? actions.error;
      if (error) {
        setState({ status: "error", message: error.message });
        return;
      }
      setState({
        status: "ready",
        data: {
          people: (people.data ?? []).map(personFromRow),
          adjustments: (adjustments.data ?? []).map(adjustmentFromRow),
          actions: (actions.data ?? []).map((a) => ({
            id: a.id as number,
            type: a.type as string,
            params: (a.params ?? {}) as Record<string, unknown>,
            appliedAtSim: a.applied_at_sim as number,
            cancelled: a.cancelled as boolean,
          })),
        },
      });
    })().catch((e: unknown) => {
      if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
    });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return state;
}
