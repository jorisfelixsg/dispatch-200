// Database row shapes (snake_case) and mappers to engine types.

import type { Step } from "@/lib/engine/config";
import type { PersonDefaults, PersonId, Role } from "@/lib/engine/people";
import type { Importance, Offer, Person, StepExecution } from "@/lib/engine/types";

export interface OfferRow {
  id: number;
  rank: number;
  merchant_name: string;
  slug: string;
  importance: Importance;
  category: string;
  description: string;
  url: string;
  image_url: string;
  logo_url: string;
}

export interface StepExecutionRow {
  offer_id: number;
  step: Step;
  done_by: PersonId;
  done_at_sim: number;
  done_at_real: string;
  in_priority: boolean;
  source: "manual" | "auto";
}

export interface PersonRow {
  id: PersonId;
  name: string;
  role: Role;
  skills: Step[];
  major_step: Step | null;
  priority_order: Step[];
  forced_mode: boolean;
  forced_sequence: Step[];
  daily_budget_min: number;
  sort_order: number;
}

export interface SimStateRow {
  now_sim: number;
  seed: number;
  auto_running: boolean;
  reference_curve: number[] | null;
  renfort_s1: { active: boolean; budgetMin?: number; sinceDay?: number };
  epoch: number;
  updated_at: string;
}

export function offerFromRow(r: OfferRow): Offer {
  return {
    id: r.id,
    rank: r.rank,
    merchantName: r.merchant_name,
    slug: r.slug,
    importance: r.importance,
    category: r.category,
    description: r.description,
    url: r.url,
    imageUrl: r.image_url,
    logoUrl: r.logo_url,
  };
}

export function offerToRow(o: Offer): OfferRow {
  return {
    id: o.id,
    rank: o.rank,
    merchant_name: o.merchantName,
    slug: o.slug,
    importance: o.importance,
    category: o.category,
    description: o.description,
    url: o.url,
    image_url: o.imageUrl,
    logo_url: o.logoUrl,
  };
}

export function executionFromRow(r: StepExecutionRow): StepExecution {
  return {
    offerId: r.offer_id,
    step: r.step,
    doneBy: r.done_by,
    doneAtSim: r.done_at_sim,
    doneAtReal: r.done_at_real,
    inPriority: r.in_priority,
    source: r.source,
  };
}

export function personFromRow(r: PersonRow): Person {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    skills: r.skills,
    majorStep: r.major_step,
    priorityOrder: r.priority_order,
    forcedMode: r.forced_mode,
    forcedSequence: r.forced_sequence,
    dailyBudgetMin: r.daily_budget_min,
  };
}

/** Default person row, as restored by a reset (R16). Forced sequence defaults to the major step (R11 #1). */
export function personDefaultsToRow(p: PersonDefaults, sortOrder: number): PersonRow {
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    skills: [...p.skills],
    major_step: p.majorStep,
    priority_order: [...p.priorityOrder],
    forced_mode: false,
    forced_sequence: p.majorStep ? [p.majorStep] : [],
    daily_budget_min: p.dailyBudgetMin,
    sort_order: sortOrder,
  };
}
