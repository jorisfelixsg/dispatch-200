import { offerToRow, personDefaultsToRow } from "@/lib/data/rows";
import { DEFAULT_PEOPLE } from "@/lib/engine/people";
import { SIM_START } from "@/lib/engine/time";
import { generateOffers } from "@/lib/seed/offers";
import { getServiceSupabase } from "@/lib/supabase/server";

/** Default simulation seed (R14, R15). */
const DEFAULT_SIM_SEED = 42;

/** R16 — Reset the demo in a single database transaction. */
export async function POST() {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return Response.json({ error: "Base de données non configurée." }, { status: 503 });
  }

  const started = Date.now();
  const { error } = await supabase.rpc("reset_demo", {
    p_offers: generateOffers().map(offerToRow),
    p_people: DEFAULT_PEOPLE.map((p, i) => personDefaultsToRow(p, i)),
    p_now_sim: SIM_START,
    p_seed: DEFAULT_SIM_SEED,
  });

  if (error) {
    const missing = error.code === "PGRST202" || error.code === "42883";
    return Response.json(
      {
        error: missing
          ? "La fonction reset_demo est absente : exécute supabase/migrations/0001_init.sql dans Supabase."
          : `Échec du reset : ${error.message}`,
      },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, durationMs: Date.now() - started });
}
