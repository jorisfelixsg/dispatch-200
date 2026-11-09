import { failure, jsonError, readJson, serviceOr503 } from "@/lib/api/http";
import { BUSINESS_DAYS } from "@/lib/engine/config";
import { advanceHours, goToDayStart, nextBusinessDay } from "@/lib/engine/clock";
import { formatSimShort } from "@/lib/engine/time";
import type { ClockAction, ClockResponse } from "@/lib/live/contracts";

const ACTIONS: readonly ClockAction[] = ["plus1h", "plus2h", "nextDay", "goToDay"];

const LABELS: Record<ClockAction, string> = {
  plus1h: "+1h",
  plus2h: "+2h",
  nextDay: "Jour suivant",
  goToDay: "Aller au début du jour",
};

const ERRORS: Record<string, string> = {
  not_seeded: "La démo n'est pas initialisée.",
  auto_running: "Simulation en cours : l'horloge est verrouillée.",
  conflict: "L'horloge vient d'être modifiée ailleurs. Réessaie.",
  backwards: "L'horloge ne recule jamais (sauf par un reset).",
};

/** R13 — move the shared clock (orchestrator). */
export async function POST(request: Request) {
  const body = await readJson(request);
  const action = body?.action;
  if (typeof action !== "string" || !(ACTIONS as readonly string[]).includes(action)) {
    return jsonError("Action d'horloge inconnue.", 400);
  }
  const day = body?.day;
  if (action === "goToDay" && (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > BUSINESS_DAYS + 1)) {
    return jsonError("Jour invalide.", 400);
  }
  const supabase = serviceOr503();
  if (supabase instanceof Response) return supabase;

  try {
    const { data: sim, error: readError } = await supabase.from("sim_state").select("now_sim, auto_running").eq("id", 1).maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!sim) return jsonError(ERRORS.not_seeded, 200);
    if (sim.auto_running) return jsonError(ERRORS.auto_running, 200);
    const now = sim.now_sim as number;

    const next =
      action === "plus1h" ? advanceHours(now, 1)
      : action === "plus2h" ? advanceHours(now, 2)
      : action === "nextDay" ? nextBusinessDay(now)
      : goToDayStart(now, day as number);

    const label = action === "goToDay" ? `${LABELS.goToDay} J${day}` : LABELS[action as ClockAction];
    const { data, error } = await supabase.rpc("set_clock", { p_expected: now, p_new: next, p_label: `${label} → ${formatSimShort(next)}` });
    if (error) throw new Error(error.message);
    const result = data as { ok: boolean; code?: string; now_sim?: number; changed?: boolean };
    if (!result.ok) return jsonError(ERRORS[result.code ?? ""] ?? "Changement d'horloge refusé.", 200);
    return Response.json({ ok: true, nowSim: result.now_sim ?? next, changed: Boolean(result.changed) } satisfies ClockResponse);
  } catch (e) {
    return failure(e);
  }
}
