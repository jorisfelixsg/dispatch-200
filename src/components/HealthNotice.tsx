"use client";

import { useHealth } from "@/hooks/useHealth";
import type { HealthStatus } from "@/app/api/health/route";

const MESSAGES: Record<Exclude<HealthStatus, "ok">, string> = {
  unconfigured: "Base de données non configurée : renseigne les variables Supabase (voir README).",
  unreachable:
    "Base de données injoignable. Si le projet Supabase est en pause, réactive-le depuis le tableau de bord Supabase (voir README).",
  no_schema:
    "Tables absentes : exécute le fichier supabase/migrations/0001_init.sql dans l'éditeur SQL de Supabase (voir README).",
  not_seeded:
    "Base vide : l'orchestrateur doit cliquer sur « Réinitialiser la démo » (écran Horloge) pour créer les 200 offres.",
};

/** Clear message when the database is not configured, unreachable or empty (spec section 8). */
export function HealthNotice() {
  const status = useHealth();
  if (status === null || status === "ok") return null;
  return (
    <div role="status" className="border-b border-warn/30 bg-warn/10 px-4 py-2 text-center text-sm text-warn">
      {MESSAGES[status]}
    </div>
  );
}
