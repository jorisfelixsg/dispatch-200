import { describe, expect, it } from "vitest";
import { declareAbsence, detectAbsences, markAbsencesDetected } from "./absences";
import { dayBudget } from "./budget";
import { computeTaskList } from "./taskList";
import { dayLeft } from "./clock";
import { exec, initialState, session } from "./testing/fixtures";
import { simAt } from "./time";

describe("R12 — absences", () => {
  it("US-14: Charlie declares an absence for J7 → his J7 budget is 0 and his list says so", () => {
    const r = declareAbsence(initialState({ nowSim: simAt(5, 600) }), "charlie", 7);
    if (!r.ok) throw new Error(r.error);
    expect(dayBudget(r.state, "charlie", 7)).toBe(0);
    expect(dayBudget(r.state, "charlie", 6)).toBe(60);
    const onJ7 = computeTaskList({ ...r.state, nowSim: simAt(7, 480) }, "charlie");
    expect(onJ7.tasks).toEqual([]);
    expect(onJ7.emptyReason).toBe("absent");
  });

  it("an absence cannot be declared for a past day", () => {
    expect(declareAbsence(initialState({ nowSim: simAt(5, 600) }), "charlie", 4)).toEqual({ ok: false, error: "past_day" });
  });

  it("US-14: Alice validated nothing at J3 without declaring an absence → « Absence détectée — Alice — J3 » when J4 starts", () => {
    const state = initialState({ nowSim: simAt(4, 480), sessions: [session("bob", 3, 30), session("charlie", 3, 12)] });
    expect(detectAbsences(state, 3)).toEqual(["alice"]);
  });

  it("a declared absence is not detected again, and the orchestrator (no budget) is never detected", () => {
    const r = declareAbsence(initialState({ nowSim: simAt(3, 480) }), "alice", 3);
    if (!r.ok) throw new Error(r.error);
    expect(detectAbsences(r.state, 3)).toEqual(["bob", "charlie"]);
  });

  it("a detected absence has no retroactive effect on the budget", () => {
    const state = markAbsencesDetected(initialState(), ["alice"], 3);
    expect(state.adjustments[0]).toMatchObject({ personId: "alice", dayIndex: 3, absentDetected: true, absentDeclared: false });
    expect(dayBudget(state, "alice", 3)).toBe(60);
  });
});

describe("R12 — PM decisions on detected absences", () => {
  it("nobody is detected absent once every step of their skills is done", () => {
    // Every S1 and S2 done: Alice has nothing left, Bob and Charlie still have S3/S4/S5 to do.
    const executions = Array.from({ length: 200 }, (_, i) => [exec(i + 1, "S1", 500), exec(i + 1, "S2", 501)]).flat();
    const state = initialState({ nowSim: simAt(17, 480), executions });
    expect(detectAbsences(state, 16)).toEqual(["bob", "charlie"]);
  });

  it("on a jump over several days, only the day being left is checked", () => {
    expect(dayLeft(simAt(3, 600), simAt(10, 480))).toBe(3);
    expect(dayLeft(simAt(3, 600), simAt(4, 480))).toBe(3);
    expect(dayLeft(simAt(3, 600), simAt(3, 720))).toBeNull();
  });
});
