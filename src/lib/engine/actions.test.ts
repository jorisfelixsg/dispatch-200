import { describe, expect, it } from "vitest";
import { declareAbsence } from "./absences";
import { ACTION_ORDER, applyAction, concernedPerson, revertAction, shouldProposeActions, type Action } from "./actions";
import { computeControls } from "./controls";
import { getPerson, initialWorldState } from "./state";
import { execRange, initialState } from "./testing/fixtures";
import { simAt } from "./time";
import { defaultOffers } from "@/lib/seed/offers";

describe("R11 — catch-up actions", () => {
  it("actions are proposed only when the global level is orange or red, always in the same order", () => {
    expect([shouldProposeActions("green"), shouldProposeActions("orange"), shouldProposeActions("red")]).toEqual([false, true, true]);
    expect(ACTION_ORDER).toEqual(["FORCE_ORDER", "RENFORT_S1", "EXTRA_HOUR", "RERANK"]);
  });

  it("the concerned person is the only competent person of the worst control (Charlie for S3)", () => {
    // Start of J5: 100 S1/S2/S4 done, 30 S3 done, Charlie absent J5 and J6 → S3 is the worst control.
    let state = initialState({
      nowSim: simAt(5, 480),
      executions: [...execRange(1, 30, ["S1", "S2", "S3", "S4"]), ...execRange(31, 100, ["S1", "S2", "S4"])],
    });
    for (const d of [5, 6]) {
      const r = declareAbsence(state, "charlie", d);
      if (r.ok) state = r.state;
    }
    expect(concernedPerson(computeControls(state).controls)).toBe("charlie");
  });

  it("no concerned person when the worst control is shared or global (the orchestrator chooses)", () => {
    const controls = computeControls(initialState()).controls.map((c) => ({ ...c, margin: c.id === "S5" ? -10 : 100 }));
    expect(concernedPerson(controls)).toBeNull();
  });

  it("R11 action 1: forced mode on, default sequence = the major step; cancel turns it off", () => {
    const action: Action = { type: "FORCE_ORDER", personId: "charlie" };
    const applied = applyAction(initialState(), action);
    expect(getPerson(applied, "charlie")).toMatchObject({ forcedMode: true, forcedSequence: ["S3"] });
    expect(getPerson(revertAction(applied, action), "charlie").forcedMode).toBe(false);
  });

  it("R11 action 2: Renfort S1 starts today; cancel stops it", () => {
    const applied = applyAction(initialState({ nowSim: simAt(10, 480) }), { type: "RENFORT_S1" });
    expect(applied.renfortS1).toEqual({ active: true, budgetPerDay: 60, sinceDay: 10 });
    expect(revertAction(applied, { type: "RENFORT_S1" }).renfortS1.active).toBe(false);
  });

  it("R11 action 4: +60 min for a person and a day; cancel removes them", () => {
    const action: Action = { type: "EXTRA_HOUR", personId: "charlie", dayIndex: 5 };
    const applied = applyAction(initialState(), action);
    expect(applied.adjustments).toEqual([{ personId: "charlie", dayIndex: 5, extraMin: 60, absentDeclared: false, absentDetected: false }]);
    expect(revertAction(applied, action).adjustments[0].extraMin).toBe(0);
  });

  it("R11 action 5 example: the 40 A merchants take ranks 1 to 40 (id order kept in each group); cancel restores id order", () => {
    const state = initialWorldState(defaultOffers());
    const applied = applyAction(state, { type: "RERANK" });
    const top40 = [...applied.offers].sort((a, b) => a.rank - b.rank).slice(0, 40);
    expect(top40.every((o) => o.importance === "A")).toBe(true);
    expect(top40.map((o) => o.id)).toEqual(state.offers.filter((o) => o.importance === "A").map((o) => o.id));
    const next40 = [...applied.offers].sort((a, b) => a.rank - b.rank).slice(40, 120);
    expect(next40.every((o) => o.importance === "B")).toBe(true);
    const reverted = revertAction(applied, { type: "RERANK" });
    expect(reverted.offers.every((o) => o.rank === o.id)).toBe(true);
  });
});
