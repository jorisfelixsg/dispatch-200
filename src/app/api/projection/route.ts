import { connection } from "next/server";
import { failure, serviceOr503 } from "@/lib/api/http";
import { loadWorld } from "@/lib/data/world";
import { projectEndOfMonth } from "@/lib/engine/projection";
import type { ProjectionResponse } from "@/lib/live/contracts";

/** 20 month simulations take a few seconds. */
export const maxDuration = 60;

/** US-17 — projection of published offers at J22 (min / median of 20 auto-mode simulations). */
export async function GET() {
  await connection();
  const supabase = serviceOr503();
  if (supabase instanceof Response) return supabase;
  try {
    const world = await loadWorld(supabase);
    const projection = projectEndOfMonth(world.state);
    return Response.json({ ok: true, projection } satisfies ProjectionResponse, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
