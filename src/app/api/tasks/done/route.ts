import { failure, jsonError, readJson, serviceOr503 } from "@/lib/api/http";
import { computeAndReserve, loadOfferSlice } from "@/lib/data/world";
import { STEPS, type Step } from "@/lib/engine/config";
import { completeStep } from "@/lib/engine/completion";
import { isPersonId, type PersonId } from "@/lib/engine/people";
import { duration } from "@/lib/engine/state";
import type { DoneResponse } from "@/lib/live/contracts";

const MESSAGES: Record<string, string> = {
  not_ready: "Cette tâche n'est plus prête.",
  not_skilled: "Cette étape ne fait pas partie de tes compétences.",
  unknown_offer: "Offre inconnue.",
  not_business_day: "L'horloge n'est pas sur un jour ouvré.",
  auto_running: "Simulation en cours : les validations manuelles sont suspendues.",
  not_seeded: "La démo n'est pas initialisée.",
};

function isStep(value: unknown): value is Step {
  return typeof value === "string" && (STEPS as readonly string[]).includes(value);
}

/** « Fait » — validates a step in one database transaction (R3, R4, R7). */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body || !isPersonId(body.personId) || !isStep(body.step) || typeof body.offerId !== "number") {
    return jsonError("Requête invalide.", 400);
  }
  const personId: PersonId = body.personId;
  const step = body.step;
  const offerId = body.offerId;
  const supabase = serviceOr503();
  if (supabase instanceof Response) return supabase;

  try {
    const world = await loadOfferSlice(supabase, offerId);
    const nameOf = (id: string) => world.state.people.find((p) => p.id === id)?.name ?? id;

    // Business refusals are normal outcomes (HTTP 200, ok: false): no error in the browser console.
    const refused = async (code: string, error: string, status = 200) => {
      const payload = await computeAndReserve(supabase, personId);
      return Response.json({ ok: false, code, error, payload } satisfies DoneResponse, { status });
    };

    if (world.autoRunning) return refused("auto_running", MESSAGES.auto_running);

    // Same checks as the engine; the database then enforces uniqueness atomically.
    const check = completeStep(world.state, { personId, offerId, step, source: "manual", doneAtReal: new Date().toISOString() });
    if (!check.ok) {
      const { error } = check;
      if (error.code === "already_done") return refused("already_done", `Déjà faite par ${nameOf(error.doneBy)}`);
      return refused(error.code, MESSAGES[error.code] ?? "Validation refusée.");
    }

    const { data, error } = await supabase.rpc("complete_step", {
      p_person: personId,
      p_offer: offerId,
      p_step: step,
      p_duration: duration(step),
      p_source: "manual",
    });
    if (error) throw new Error(error.message);
    const result = data as { ok: boolean; code?: string; done_by?: string; done_at_sim?: number };
    if (!result.ok) {
      if (result.code === "already_done") return refused("already_done", `Déjà faite par ${nameOf(result.done_by ?? "")}`);
      return refused(result.code ?? "refused", MESSAGES[result.code ?? ""] ?? "Validation refusée.");
    }

    const payload = await computeAndReserve(supabase, personId);
    return Response.json({ ok: true, doneAtSim: result.done_at_sim ?? 0, payload } satisfies DoneResponse);
  } catch (e) {
    return failure(e);
  }
}
