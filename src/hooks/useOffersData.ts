"use client";

import { useCallback, useEffect, useState } from "react";
import {
  executionFromRow,
  offerFromRow,
  personFromRow,
  type OfferRow,
  type PersonRow,
  type StepExecutionRow,
} from "@/lib/data/rows";
import type { Offer, Person, StepExecution } from "@/lib/engine/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export interface OffersData {
  offers: Offer[];
  executions: StepExecution[];
  people: Person[];
}

export type OffersDataState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: OffersData };

/**
 * Offers, step executions and people, read with the anon key.
 * Reloads whenever `reloadKey` changes (e.g. the reset epoch). Live updates arrive in step 4.
 */
export function useOffersData(reloadKey: unknown): OffersDataState & { reload: () => void } {
  const [state, setState] = useState<OffersDataState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const [offers, executions, people] = await Promise.all([
        supabase.from("offer").select("*").order("rank").range(0, 999).returns<OfferRow[]>(),
        supabase.from("step_execution").select("*").range(0, 1999).returns<StepExecutionRow[]>(),
        supabase.from("person").select("*").order("sort_order").returns<PersonRow[]>(),
      ]);
      if (cancelled) return;
      const error = offers.error ?? executions.error ?? people.error;
      if (error) {
        setState({ status: "error", message: error.message });
        return;
      }
      setState({
        status: "ready",
        data: {
          offers: (offers.data ?? []).map(offerFromRow),
          executions: (executions.data ?? []).map(executionFromRow),
          people: (people.data ?? []).map(personFromRow),
        },
      });
    })().catch((e: unknown) => {
      if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, tick]);

  if (!getBrowserSupabase()) {
    return { status: "error", message: "Base de données non configurée.", reload };
  }
  return { ...state, reload };
}
