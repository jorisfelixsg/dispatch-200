"use client";

import type { ActionType } from "@/lib/engine/actions";
import type { PersonId } from "@/lib/engine/people";
import type { ActionsResponse } from "./contracts";
import { refreshControlReport } from "./controlReport";

async function post(body: unknown): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("/api/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as ActionsResponse;
    await refreshControlReport();
    return data.ok ? { ok: true, message: "" } : { ok: false, message: data.error };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** R11 — apply a catch-up action. */
export function applyActionRequest(type: ActionType, personId?: PersonId | null, dayIndex?: number | null) {
  return post({ op: "apply", type, personId: personId ?? undefined, dayIndex: dayIndex ?? undefined });
}

/** R11 — cancel an applied action. */
export function cancelActionRequest(id: number) {
  return post({ op: "cancel", id });
}
