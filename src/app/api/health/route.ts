import { connection } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";
import { isServiceConfigured } from "@/lib/supabase/server";

export type HealthStatus = "ok" | "unconfigured" | "unreachable";

export interface HealthResponse {
  status: HealthStatus;
  serviceKey: boolean;
}

export async function GET() {
  await connection(); // always evaluate at request time (env and reachability can change)
  if (!isSupabaseConfigured()) {
    return Response.json({ status: "unconfigured", serviceKey: isServiceConfigured() } satisfies HealthResponse);
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const status: HealthStatus = res.ok ? "ok" : "unreachable";
    return Response.json({ status, serviceKey: isServiceConfigured() } satisfies HealthResponse);
  } catch {
    return Response.json({ status: "unreachable", serviceKey: isServiceConfigured() } satisfies HealthResponse);
  }
}
