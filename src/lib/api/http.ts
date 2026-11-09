import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NotSeededError } from "@/lib/data/world";
import { getServiceSupabase } from "@/lib/supabase/server";

export function jsonError(error: string, status: number, extra: Record<string, unknown> = {}): Response {
  return Response.json({ ok: false, error, ...extra }, { status });
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Service client, or a ready-made 503 response when the server is not configured. */
export function serviceOr503(): SupabaseClient | Response {
  return getServiceSupabase() ?? jsonError("Base de données non configurée.", 503);
}

/** Turns an unexpected failure into a French JSON error. Missing SQL functions get a hint. */
export function failure(e: unknown): Response {
  if (e instanceof NotSeededError) return jsonError(e.message, 409, { code: "not_seeded" });
  const message = e instanceof Error ? e.message : String(e);
  if (/Could not find the function|PGRST202|42883/.test(message)) {
    return jsonError("Fonction SQL absente : exécute supabase/migrations/0002_live_tasks.sql dans Supabase.", 500, {
      code: "missing_sql",
    });
  }
  return jsonError(message, 500);
}
