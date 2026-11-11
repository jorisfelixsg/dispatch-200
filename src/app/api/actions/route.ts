import { failure, jsonError, readJson, serviceOr503 } from "@/lib/api/http";
import { loadWorld } from "@/lib/data/world";
import { ACTION_ORDER, applyAction, checkAction, revertAction, type Action, type ActionRefusal } from "@/lib/engine/actions";
import { BUSINESS_DAYS } from "@/lib/engine/config";
import { isPersonId } from "@/lib/engine/people";
import type { WorldState } from "@/lib/engine/types";
import type { ActionPreview, ActionsResponse, PreviewResponse } from "@/lib/live/contracts";
import { computeControls } from "@/lib/engine/controls";

// Only the proposed actions can be applied or previewed; any stored action can still be cancelled.
const TYPES = ACTION_ORDER;

const REFUSALS: Record<ActionRefusal | "auto_running" | "already_cancelled" | "not_seeded" | "unknown_action", string> = {
  unknown_person: "Personne inconnue.",
  not_contributor: "Cette action s'applique à un contributeur (Alice, Bob ou Charlie).",
  already_forced: "Le mode forcé est déjà actif pour cette personne.",
  already_active: "Le renfort S1 est déjà actif.",
  already_ranked: "Les marchands sont déjà classés par importance.",
  past_day: "Ce jour est déjà passé.",
  absent_that_day: "Cette personne est déclarée absente ce jour-là : choisis un autre jour.",
  auto_running: "Simulation en cours : réessaie dans un instant.",
  already_cancelled: "Cette action est déjà annulée.",
  not_seeded: "La démo n'est pas initialisée.",
  unknown_action: "Action introuvable.",
};

/** Builds an engine action from the request (apply) or from a stored row (cancel). */
function toAction(type: unknown, params: Record<string, unknown>): Action | null {
  switch (type) {
    case "FORCE_ORDER":
      return isPersonId(params.personId) ? { type, personId: params.personId } : null;
    case "RENFORT_S1":
    case "RERANK":
      return { type };
    case "EXTRA_HOUR": {
      const day = params.dayIndex;
      if (!isPersonId(params.personId) || typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > BUSINESS_DAYS) return null;
      return { type, personId: params.personId, dayIndex: day };
    }
    default:
      return null;
  }
}

/** Database writes needed to go from `before` to `after` (only what changed). */
function diff(before: WorldState, after: WorldState) {
  const people = after.people
    .filter((p) => JSON.stringify(p) !== JSON.stringify(before.people.find((b) => b.id === p.id)))
    .map((p) => ({ id: p.id, skills: p.skills, priority_order: p.priorityOrder, forced_mode: p.forcedMode, forced_sequence: p.forcedSequence }));
  const renfort =
    JSON.stringify(after.renfortS1) === JSON.stringify(before.renfortS1)
      ? null
      : { active: after.renfortS1.active, budgetMin: after.renfortS1.budgetPerDay, sinceDay: after.renfortS1.sinceDay };
  const adjustments = after.adjustments
    .filter((a) => before.adjustments.find((b) => b.personId === a.personId && b.dayIndex === a.dayIndex)?.extraMin !== a.extraMin)
    .map((a) => ({ person_id: a.personId, day_index: a.dayIndex, extra_min: a.extraMin }));
  const rankChanged = after.offers.some((o) => before.offers.find((b) => b.id === o.id)?.rank !== o.rank);
  const ranks = rankChanged ? after.offers.map((o) => ({ id: o.id, rank: o.rank })) : null;
  return { people, renfort, adjustments, ranks };
}

/**
 * R11 — apply (op: "apply") or cancel (op: "cancel", id) a catch-up action, in one transaction.
 * US-18 — op: "preview" returns the impact of an action without applying it.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body || (body.op !== "apply" && body.op !== "cancel" && body.op !== "preview")) return jsonError("Requête invalide.", 400);
  const supabase = serviceOr503();
  if (supabase instanceof Response) return supabase;

  try {
    const world = await loadWorld(supabase);
    let action: Action | null;
    let actionId: number | null = null;

    if (body.op === "apply" || body.op === "preview") {
      if (!(TYPES as readonly unknown[]).includes(body.type)) return jsonError("Action inconnue.", 400);
      action = toAction(body.type, { personId: body.personId, dayIndex: body.dayIndex });
      if (!action) return jsonError("Paramètres de l'action invalides.", 400);
      const refusal = checkAction(world.state, action);
      if (refusal) return jsonError(REFUSALS[refusal], 200, { code: refusal });
    } else {
      if (typeof body.id !== "number") return jsonError("Requête invalide.", 400);
      const { data, error } = await supabase.from("applied_action").select("id, type, params, cancelled").eq("id", body.id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return jsonError(REFUSALS.unknown_action, 200, { code: "unknown_action" });
      if (data.cancelled) return jsonError(REFUSALS.already_cancelled, 200, { code: "already_cancelled" });
      action = toAction(data.type, (data.params ?? {}) as Record<string, unknown>);
      if (!action) return jsonError(REFUSALS.unknown_action, 200, { code: "unknown_action" });
      actionId = data.id as number;
    }

    const after = body.op === "cancel" ? revertAction(world.state, action) : applyAction(world.state, action);

    if (body.op === "preview") {
      // US-18 — the controls whose margin changes, before and after.
      const before = computeControls(world.state);
      const next = computeControls(after);
      const preview: ActionPreview = {
        changes: before.controls
          .map((c) => ({ controlId: c.id, marginBefore: c.margin, marginAfter: next.controls.find((n) => n.id === c.id)?.margin ?? c.margin }))
          .filter((c) => c.marginAfter !== c.marginBefore),
        levelBefore: before.level,
        levelAfter: next.level,
      };
      return Response.json({ ok: true, preview } satisfies PreviewResponse);
    }

    const changes = diff(world.state, after);
    const params = Object.fromEntries(Object.entries(action).filter(([k]) => k !== "type"));
    if (action.type === "RENFORT_S1" && body.op === "apply") Object.assign(params, { sinceDay: after.renfortS1.sinceDay });

    const { data, error } = await supabase.rpc("persist_action", {
      p_action_id: actionId,
      p_type: action.type,
      p_params: params,
      p_at_sim: world.state.nowSim,
      p_people: changes.people,
      p_renfort: changes.renfort,
      p_adjustments: changes.adjustments,
      p_ranks: changes.ranks,
    });
    if (error) throw new Error(error.message);
    const result = data as { ok: boolean; code?: keyof typeof REFUSALS; id?: number };
    if (!result.ok) return jsonError(REFUSALS[result.code ?? "unknown_action"] ?? "Action refusée.", 200, { code: result.code });
    return Response.json({ ok: true, id: result.id ?? 0 } satisfies ActionsResponse);
  } catch (e) {
    return failure(e);
  }
}
