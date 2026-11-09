import { offerToRow, personDefaultsToRow } from "@/lib/data/rows";
import { REFERENCE_SEED, referenceCurve } from "@/lib/engine/autoplay";
import { DEFAULT_PEOPLE } from "@/lib/engine/people";
import { SIM_START } from "@/lib/engine/time";
import { generateOffers } from "@/lib/seed/offers";
import { getServiceSupabase } from "@/lib/supabase/server";

/** R16 — Reset the demo in a single database transaction, with the reference trajectory (R15). */
export async function POST() {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return Response.json({ error: "Base de données non configurée." }, { status: 503 });
  }

  const started = Date.now();
  const offers = generateOffers();
  const { error } = await supabase.rpc("reset_demo", {
    p_offers: offers.map(offerToRow),
    p_people: DEFAULT_PEOPLE.map((p, i) => personDefaultsToRow(p, i)),
    p_now_sim: SIM_START,
    p_seed: REFERENCE_SEED,
    p_reference_curve: referenceCurve(offers, REFERENCE_SEED),
  });

  if (error) {
    const missing = error.code === "PGRST202" || error.code === "42883";
    return Response.json(
      {
        error: missing
          ? "La fonction reset_demo est absente ou ancienne : exécute les scripts de supabase/migrations (0001 à 0003) dans Supabase."
          : `Échec du reset : ${error.message}`,
      },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, durationMs: Date.now() - started });
}
