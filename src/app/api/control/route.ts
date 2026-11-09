import { connection } from "next/server";
import { failure, serviceOr503 } from "@/lib/api/http";
import { loadWorld } from "@/lib/data/world";
import { proposeActions } from "@/lib/engine/actions";
import { computeControls } from "@/lib/engine/controls";
import { currentDay } from "@/lib/engine/state";
import { actualCurve, computeIndicators } from "@/lib/engine/indicators";
import type { ActiveAction, ControlResponse } from "@/lib/live/contracts";

/** E2 — control tower: R9 controls, R10 levels, indicators, actual vs reference curve. */
export async function GET() {
  await connection(); // always computed at request time
  const supabase = serviceOr503();
  if (supabase instanceof Response) return supabase;
  try {
    const [world, actions] = await Promise.all([
      loadWorld(supabase),
      supabase.from("applied_action").select("id, type, params, applied_at_sim").eq("cancelled", false).order("id"),
    ]);
    if (actions.error) throw new Error(actions.error.message);
    const report = computeControls(world.state);
    const activeActions: ActiveAction[] = (actions.data ?? []).map((a) => ({
      id: a.id as number,
      type: a.type as ActiveAction["type"],
      params: (a.params ?? {}) as ActiveAction["params"],
      appliedAtSim: a.applied_at_sim as number,
    }));
    return Response.json(
      {
        ok: true,
        payload: {
          nowSim: world.state.nowSim,
          level: report.level,
          controls: report.controls,
          indicators: computeIndicators(world.state),
          actualCurve: actualCurve(world.state),
          referenceCurve: world.referenceCurve,
          proposals: proposeActions(world.state, report.controls, report.level),
          activeActions,
          renfortActive: world.state.renfortS1.active,
          forcedPeople: world.state.people.filter((p) => p.forcedMode).map((p) => p.id),
          today: currentDay(world.state),
        },
      } satisfies ControlResponse,
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
