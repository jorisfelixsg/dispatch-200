import { failure, jsonError, readJson, serviceOr503 } from "@/lib/api/http";
import { saveSnapshots } from "@/lib/data/snapshots";
import { loadWorld } from "@/lib/data/world";
import { BUSINESS_DAYS } from "@/lib/engine/config";
import { playCurrentDay, playUntilDay, publishedCount } from "@/lib/engine/autoplay";
import type { AutoResponse } from "@/lib/live/contracts";

const ERRORS: Record<string, string> = {
  not_seeded: "La démo n'est pas initialisée.",
  auto_running: "Une simulation est déjà en cours.",
  reset: "La démo a été réinitialisée pendant la simulation : résultat abandonné.",
};

/** Simulation of a whole month takes well under a second; this leaves room for slow databases. */
export const maxDuration = 60;

/**
 * R14 — auto mode. Takes the lock (manual clicks refused), plays on an in-memory copy with the
 * same engine functions, then writes the result and releases the lock in one transaction.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  const mode = body?.mode;
  const day = body?.day;
  const seedInput = body?.seed;
  if (mode !== "day" && mode !== "untilDay") return jsonError("Mode inconnu.", 400);
  if (mode === "untilDay" && (typeof day !== "number" || !Number.isInteger(day) || day < 2 || day > BUSINESS_DAYS + 1)) {
    return jsonError("Jour invalide.", 400);
  }
  if (seedInput !== undefined && (typeof seedInput !== "number" || !Number.isInteger(seedInput) || seedInput < 0 || seedInput > 2_147_483_647)) {
    return jsonError("La graine doit être un entier positif.", 400);
  }
  const supabase = serviceOr503();
  if (supabase instanceof Response) return supabase;

  const { data: lockData, error: lockError } = await supabase.rpc("start_auto");
  if (lockError) return failure(new Error(lockError.message));
  const lock = lockData as { ok: boolean; code?: string; seed?: number; epoch?: number };
  if (!lock.ok) return jsonError(ERRORS[lock.code ?? ""] ?? "Simulation refusée.", 200, { code: lock.code });
  const epoch = lock.epoch ?? 0;

  try {
    const started = Date.now();
    const world = await loadWorld(supabase);
    const seed = typeof seedInput === "number" ? seedInput : (lock.seed ?? 42);
    const doneAtReal = new Date().toISOString();
    const fromSim = world.state.nowSim;
    const result =
      mode === "day" ? playCurrentDay(world.state, seed, doneAtReal) : playUntilDay(world.state, day as number, seed, doneAtReal);

    const played = new Set(result.daysPlayed);
    const published = publishedCount(result.state);
    const lastPublication = result.state.executions
      .filter((e) => e.step === "S5")
      .reduce<number | null>((max, e) => (max === null || e.doneAtSim > max ? e.doneAtSim : max), null);

    const events = [
      ...result.events,
      {
        type: "AUTO_RUN" as const,
        personId: "orchestrator" as const,
        payload: { seed, fromSim, toSim: result.state.nowSim, days: result.daysPlayed, steps: result.executions.length, published },
        atSim: result.state.nowSim,
      },
    ];

    const { data, error } = await supabase.rpc("finish_auto", {
      p_epoch: epoch,
      p_seed: seed,
      p_now_sim: result.state.nowSim,
      p_executions: result.executions.map((e) => ({
        offer_id: e.offerId,
        step: e.step,
        done_by: e.doneBy,
        done_at_sim: e.doneAtSim,
        done_at_real: e.doneAtReal,
      })),
      p_sessions: result.state.sessions
        .filter((s) => played.has(s.dayIndex))
        .map((s) => ({ person_id: s.personId, day_index: s.dayIndex, cursor_sim: s.cursorSim, consumed_min: s.consumedMin })),
      p_absences: result.events
        .filter((e) => e.type === "ABSENCE_DETECTED")
        .map((e) => ({ person_id: e.personId, day_index: e.payload.dayIndex })),
      p_events: events.map((e) => ({ type: e.type, person_id: e.personId, payload: e.payload, at_sim: e.atSim })),
    });
    if (error) throw new Error(error.message);
    const finish = data as { ok: boolean; code?: string };
    if (!finish.ok) return jsonError(ERRORS[finish.code ?? ""] ?? "Résultat de simulation refusé.", 200, { code: finish.code });
    await saveSnapshots(
      supabase,
      result.snapshots.map((s) => ({ day_index: s.dayIndex, at_sim: s.atSim, level: s.level, controls: s.controls })),
    );

    return Response.json({
      ok: true,
      seed,
      daysPlayed: result.daysPlayed,
      steps: result.executions.length,
      published,
      lastPublication,
      nowSim: result.state.nowSim,
      durationMs: Date.now() - started,
    } satisfies AutoResponse);
  } catch (e) {
    await supabase.rpc("release_auto", { p_epoch: epoch });
    return failure(e);
  }
}
