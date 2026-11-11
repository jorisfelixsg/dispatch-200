import { describe, expect, it } from "vitest";
import { declareAbsence } from "./absences";
import { applyAction } from "./actions";
import { computeControl, computeControls, levelOf, worstLevel } from "./controls";
import { execRange, initialState } from "./testing/fixtures";
import type { Step } from "./config";
import { SIM_END, simAt } from "./time";
import type { WorldState } from "./types";

function absent(state: WorldState, personId: "alice" | "bob" | "charlie", ...days: number[]): WorldState {
  return days.reduce((s, d) => {
    const r = declareAbsence(s, personId, d);
    if (!r.ok) throw new Error(r.error);
    return r.state;
  }, state);
}

/** Start of J5 with 30 S3 done (R9 degradation example). */
function degradationState(): WorldState {
  return initialState({ nowSim: simAt(5, 480), executions: execRange(1, 30, ["S1", "S2", "S3"]) });
}

describe("R9 — capacity controls", () => {
  it("R9 table at J1 08:00: margins +540 / +120 / +600 / +240 / +360", () => {
    const { controls } = computeControls(initialState());
    const byId = Object.fromEntries(controls.map((c) => [c.id, c]));
    expect(byId.S2).toMatchObject({ need: 600, capacity: 1140, margin: 540, deadlineDay: 19 });
    expect(byId.S3).toMatchObject({ need: 1200, capacity: 1320, margin: 120, deadlineDay: 22 });
    expect(byId.S4).toMatchObject({ need: 600, capacity: 1200, margin: 600, deadlineDay: 20 });
    expect(byId.S5).toMatchObject({ need: 600, capacity: 840, margin: 240, deadlineDay: 22 });
    expect(byId.global).toMatchObject({ need: 3600, capacity: 3960, margin: 360, deadlineDay: 22 });
    expect(byId.S2.marginDays).toBe(9);
  });

  it("US-09: the initial state is green", () => {
    expect(computeControls(initialState()).level).toBe("green");
  });

  it("R9 degradation example: start of J5, 30 S3 done → S3 need 1 020 vs 1 080, margin +60", () => {
    expect(computeControl(degradationState(), "S3")).toMatchObject({ need: 1020, capacity: 1080, margin: 60 });
  });

  it("R9 degradation example: with 1 declared absence day → 1 020 vs 1 020, margin 0", () => {
    expect(computeControl(absent(degradationState(), "charlie", 5), "S3")).toMatchObject({ capacity: 1020, margin: 0 });
  });

  it("R9 degradation example: with 2 declared absence days → 960 vs 1 020, margin −60", () => {
    expect(computeControl(absent(degradationState(), "charlie", 5, 6), "S3")).toMatchObject({ capacity: 960, margin: -60 });
  });

  it("US-09: Charlie absent at J5 and J6 → S3 margin −60 and global level red", () => {
    const report = computeControls(absent(degradationState(), "charlie", 5, 6));
    expect(report.controls.find((c) => c.id === "S3")?.margin).toBe(-60);
    expect(report.level).toBe("red");
  });

  it("R11 action 2 example: Renfort S1 at J10, 13 days left → global capacity +780 min", () => {
    const state = initialState({ nowSim: simAt(10, 480) });
    const before = computeControl(state, "global").capacity;
    const after = computeControl(applyAction(state, { type: "RENFORT_S1" }), "global").capacity;
    expect(after - before).toBe(780);
  });

  it("R11 action 4 example: Charlie +60 today → S3 margin +60", () => {
    const state = degradationState();
    const before = computeControl(state, "S3").margin;
    const after = computeControl(applyAction(state, { type: "EXTRA_HOUR", personId: "charlie", dayIndex: 5 }), "S3").margin;
    expect(after - before).toBe(60);
  });

  it("capacity already used today is not available any more", () => {
    const state = initialState({ sessions: [{ personId: "charlie", dayIndex: 1, cursorSim: 0, consumedMin: 30 }] });
    expect(computeControl(state, "S3").capacity).toBe(1290);
  });
});

describe("R10 — levels", () => {
  it("green above 60 min, orange from 0 to 60, red below 0", () => {
    expect([levelOf(61), levelOf(60), levelOf(0), levelOf(-1)]).toEqual(["green", "orange", "orange", "red"]);
  });

  it("R10 example: margins +540, 0, +600, +240, +360 → global orange", () => {
    expect(worstLevel([540, 0, 600, 240, 360].map(levelOf))).toBe("orange");
  });
});

describe("R10 — a step with nothing left to do (PM 2026-11-11)", () => {
  const ALL: readonly Step[] = ["S1", "S2", "S3", "S4", "S5"];

  it("end of month, everything done: every control is green (not 0 vs 0 = orange)", () => {
    const report = computeControls(initialState({ nowSim: SIM_END, executions: execRange(1, 200, ALL) }));
    expect(report.controls.map((c) => [c.need, c.level])).toEqual(Array(5).fill([0, "green"]));
    expect(report.level).toBe("green");
  });

  it("J20, every S2 done: S2 stays green after its J19 deadline", () => {
    const state = initialState({ nowSim: simAt(20, 480), executions: execRange(1, 200, ["S1", "S2"]) });
    expect(computeControl(state, "S2")).toMatchObject({ need: 0, capacity: 0, level: "green" });
  });
});
