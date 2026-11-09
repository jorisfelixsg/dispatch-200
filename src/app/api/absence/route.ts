import { failure, jsonError, readJson, serviceOr503 } from "@/lib/api/http";
import { computeAndReserve, loadWorld } from "@/lib/data/world";
import { declareAbsence } from "@/lib/engine/absences";
import { BUSINESS_DAYS } from "@/lib/engine/config";
import { isPersonId } from "@/lib/engine/people";
import type { AbsenceResponse } from "@/lib/live/contracts";

/** R12 — declared absence, for today or a future day: the budget of that day becomes 0. */
export async function POST(request: Request) {
  const body = await readJson(request);
  const day = body?.dayIndex;
  if (!body || !isPersonId(body.personId)) return jsonError("Profil inconnu.", 400);
  if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > BUSINESS_DAYS) return jsonError("Jour invalide.", 400);
  const personId = body.personId;
  const supabase = serviceOr503();
  if (supabase instanceof Response) return supabase;

  try {
    const world = await loadWorld(supabase);
    const check = declareAbsence(world.state, personId, day);
    if (!check.ok) return jsonError("On ne peut pas déclarer une absence pour un jour passé.", 200, { code: check.error });

    const { error } = await supabase
      .from("day_adjustment")
      .upsert({ person_id: personId, day_index: day, absent_declared: true }, { onConflict: "person_id,day_index" });
    if (error) throw new Error(error.message);
    const { error: eventError } = await supabase
      .from("event")
      .insert({ type: "ABSENCE_DECLARED", person_id: personId, payload: { dayIndex: day }, at_sim: world.state.nowSim });
    if (eventError) throw new Error(eventError.message);

    const payload = await computeAndReserve(supabase, personId);
    return Response.json({ ok: true, payload } satisfies AbsenceResponse);
  } catch (e) {
    return failure(e);
  }
}
