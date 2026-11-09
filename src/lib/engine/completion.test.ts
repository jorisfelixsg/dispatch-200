import { describe, expect, it } from "vitest";
import { budgetStatus } from "./budget";
import { nextBusinessDay } from "./clock";
import { completeStep, type CompleteInput } from "./completion";
import { s5AvailableAt } from "./offerStatus";
import { stampCompletion } from "./session";
import { computeTaskList } from "./taskList";
import { exec, execRange, initialState } from "./testing/fixtures";
import { simAt } from "./time";
import type { WorldState } from "./types";

function input(personId: CompleteInput["personId"], offerId: number, step: CompleteInput["step"], inPriority = true): CompleteInput {
  return { personId, offerId, step, source: "manual", inPriority, doneAtReal: "2026-11-09T10:00:00Z" };
}

function mustComplete(state: WorldState, i: CompleteInput) {
  const r = completeStep(state, i);
  if (!r.ok) throw new Error(`unexpected refusal: ${r.error.code}`);
  return r;
}

describe("R3 — session timestamping", () => {
  it("R3 example: Bob opens his session at J2 10:00 → 1st S4 at 10:03, 2nd at 10:06, 20th at 11:00; its S5 from J3 11:00", () => {
    let state = initialState({ nowSim: simAt(2, 600), executions: execRange(1, 20, ["S2"]) });
    const ends: number[] = [];
    for (let id = 1; id <= 20; id++) {
      const r = mustComplete(state, input("bob", id, "S4"));
      ends.push(r.execution.doneAtSim);
      state = r.state;
    }
    expect(ends[0]).toBe(simAt(2, 603));
    expect(ends[1]).toBe(simAt(2, 606));
    expect(ends[19]).toBe(simAt(2, 660));
    expect(s5AvailableAt({ S4: exec(20, "S4", ends[19]) })).toBe(simAt(3, 660));
  });

  it("a cursor behind now_sim jumps to now_sim", () => {
    expect(stampCompletion({ personId: "bob", dayIndex: 2, cursorSim: simAt(2, 606), consumedMin: 6 }, simAt(2, 700), 3))
      .toEqual({ doneAtSim: simAt(2, 703), cursorSim: simAt(2, 703) });
    expect(stampCompletion(undefined, simAt(2, 700), 6)).toEqual({ doneAtSim: simAt(2, 706), cursorSim: simAt(2, 706) });
  });
});

describe("« Fait » click (US-03, US-05, R7, R8)", () => {
  it("US-03: Alice validates S2 r5 → recorded with author and end time, her budget drops by 3 min", () => {
    const state = initialState({ nowSim: simAt(1, 540) });
    const r = mustComplete(state, input("alice", 5, "S2"));
    expect(r.execution).toMatchObject({ offerId: 5, step: "S2", doneBy: "alice", doneAtSim: simAt(1, 543), inPriority: true });
    expect(budgetStatus(r.state, "alice").remaining).toBe(57);
    expect(r.events.map((e) => e.type)).toEqual(["STEP_DONE"]);
  });

  it("US-03 / R7: Bob validates an S5, then Charlie → refused « Déjà faite par Bob »", () => {
    const executions = [exec(4, "S1", 490), exec(4, "S2", 491), exec(4, "S3", 600, "charlie"), exec(4, "S4", 700, "bob")];
    const state = initialState({ nowSim: simAt(3, 600), executions });
    const bob = mustComplete(state, input("bob", 4, "S5"));
    const charlie = completeStep(bob.state, input("charlie", 4, "S5"));
    expect(charlie).toEqual({ ok: false, error: { code: "already_done", doneBy: "bob" } });
  });

  it("R8: a step validated from « Autres tâches possibles » is stored out of priority and logs OUT_OF_PRIORITY", () => {
    const r = mustComplete(initialState(), input("bob", 150, "S1", false));
    expect(r.execution.inPriority).toBe(false);
    expect(r.events.map((e) => e.type)).toEqual(["STEP_DONE", "OUT_OF_PRIORITY"]);
  });

  it("US-05: after 20 S4 (60 min) Bob's list is empty (« Ton heure du jour est faite »); next day the budget is back to 60", () => {
    let state = initialState({ nowSim: simAt(2, 600), executions: execRange(1, 40, ["S2"]) });
    for (let id = 1; id <= 20; id++) state = mustComplete(state, input("bob", id, "S4")).state;
    const list = computeTaskList(state, "bob");
    expect(list.tasks).toEqual([]);
    expect(list.emptyReason).toBe("budgetExhausted");
    const tomorrow = { ...state, nowSim: nextBusinessDay(state.nowSim) };
    expect(budgetStatus(tomorrow, "bob").remaining).toBe(60);
  });

  it("refuses a step that is not ready or outside the person's skills", () => {
    const executions = [exec(3, "S1", 500), exec(3, "S2", 510), exec(3, "S3", 900), exec(3, "S4", simAt(2, 603), "bob")];
    const state = initialState({ nowSim: simAt(3, 600), executions });
    expect(completeStep(state, input("bob", 3, "S5"))).toEqual({ ok: false, error: { code: "not_ready" } });
    expect(completeStep(state, input("alice", 3, "S5"))).toEqual({ ok: false, error: { code: "not_skilled" } });
  });

  it("the completed task leaves every reservation", () => {
    const state = initialState({ reservations: [{ personId: "charlie", offerId: 1, step: "S1", expiresAtReal: 2_000_000 }] });
    expect(mustComplete(state, input("bob", 1, "S1")).state.reservations).toEqual([]);
  });
});
