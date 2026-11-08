"use client";

import { useEffect, useState } from "react";
import type { HealthResponse, HealthStatus } from "@/app/api/health/route";

/** Database reachability, polled every 30 s. `null` while the first check runs. */
export function useHealth(): HealthStatus | null {
  const [status, setStatus] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const body = (await res.json()) as HealthResponse;
        if (!cancelled) setStatus(body.status);
      } catch {
        if (!cancelled) setStatus("unreachable");
      }
    };
    check();
    const timer = window.setInterval(check, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return status;
}
