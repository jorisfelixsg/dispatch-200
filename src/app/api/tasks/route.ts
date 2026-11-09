import { failure, jsonError, readJson, serviceOr503 } from "@/lib/api/http";
import { computeAndReserve } from "@/lib/data/world";
import { isPersonId } from "@/lib/engine/people";
import type { TasksResponse } from "@/lib/live/contracts";

/**
 * R5 + R7 — the "Mes tâches" list of a person, whose tasks are reserved for 60 s.
 * Called on every change (R6) and as the 20 s heartbeat.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body || !isPersonId(body.personId)) return jsonError("Profil inconnu.", 400);
  const supabase = serviceOr503();
  if (supabase instanceof Response) return supabase;
  try {
    const payload = await computeAndReserve(supabase, body.personId);
    return Response.json({ ok: true, payload } satisfies TasksResponse);
  } catch (e) {
    return failure(e);
  }
}
