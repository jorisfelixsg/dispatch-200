import { connection } from "next/server";
import { failure, serviceOr503 } from "@/lib/api/http";
import { loadWorld } from "@/lib/data/world";
import { computeControls } from "@/lib/engine/controls";
import { actualCurve, computeIndicators } from "@/lib/engine/indicators";
import type { ControlResponse } from "@/lib/live/contracts";

/** E2 — control tower: R9 controls, R10 levels, indicators, actual vs reference curve. */
export async function GET() {
  await connection(); // always computed at request time
  const supabase = serviceOr503();
  if (supabase instanceof Response) return supabase;
  try {
    const world = await loadWorld(supabase);
    const report = computeControls(world.state);
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
        },
      } satisfies ControlResponse,
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
