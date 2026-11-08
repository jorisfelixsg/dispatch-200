"use client";

import { useHealth } from "@/hooks/useHealth";

/** Clear message when the database is not configured or unreachable (spec section 8). */
export function HealthNotice() {
  const status = useHealth();
  if (status === null || status === "ok") return null;
  const message =
    status === "unconfigured"
      ? "Base de données non configurée : renseigne les variables Supabase (voir README)."
      : "Base de données injoignable. Si le projet Supabase est en pause, réactive-le depuis le tableau de bord Supabase (voir README).";
  return (
    <div role="status" className="border-b border-warn/30 bg-warn/10 px-4 py-2 text-center text-sm text-warn">
      {message}
    </div>
  );
}
