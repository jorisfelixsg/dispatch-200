import { connection } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";
import { isServiceConfigured } from "@/lib/supabase/server";

export type HealthStatus = "ok" | "unconfigured" | "unreachable" | "no_schema" | "not_seeded";

export interface HealthResponse {
  status: HealthStatus;
  serviceKey: boolean;
}

function reply(status: HealthStatus) {
  return Response.json({ status, serviceKey: isServiceConfigured() } satisfies HealthResponse);
}

/** Database reachability, schema presence and initial data, checked with the public (anon) key. */
export async function GET() {
  await connection(); // always evaluate at request time (env and reachability can change)
  if (!isSupabaseConfigured()) return reply("unconfigured");

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sim_state?select=now_sim`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 404) return reply("no_schema");
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { code?: string };
      return reply(body.code === "PGRST205" || body.code === "42P01" ? "no_schema" : "unreachable");
    }
    const rows = (await res.json()) as unknown[];
    return reply(rows.length > 0 ? "ok" : "not_seeded");
  } catch {
    return reply("unreachable");
  }
}
