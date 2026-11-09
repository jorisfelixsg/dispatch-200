import { describe, expect, it } from "vitest";
import { playUntilDay, referenceCurve } from "./autoplay";
import { actualCurve, computeIndicators } from "./indicators";
import { exec, initialState, makeOffers } from "./testing/fixtures";
import { simAt } from "./time";

describe("E2 — indicators", () => {
  it("US-09: at the initial state, 0 / 200 published, nothing done, day 1 / 22", () => {
    const i = computeIndicators(initialState());
    expect(i).toMatchObject({ published: 0, offerCount: 200, currentDay: 1, endOfMonth: false });
    expect(i.doneByStep).toEqual({ S1: 0, S2: 0, S3: 0, S4: 0, S5: 0 });
  });

  it("counts the steps done per step", () => {
    const state = initialState({ nowSim: simAt(3, 600), executions: [exec(1, "S1", 500), exec(1, "S2", 510), exec(2, "S2", 520)] });
    expect(computeIndicators(state).doneByStep).toMatchObject({ S1: 1, S2: 2, S3: 0 });
  });
});

describe("US-15 — actual curve vs reference", () => {
  it("the actual curve has one point per day up to today, counting S5 done by the end of each day", () => {
    const executions = [exec(1, "S5", simAt(2, 700)), exec(2, "S5", simAt(2, 1150)), exec(3, "S5", simAt(3, 600))];
    expect(actualCurve(initialState({ nowSim: simAt(4, 480), executions }))).toEqual([0, 2, 3, 3]);
  });

  it("playing the whole month with seed 42 from the initial state reproduces the reference trajectory", () => {
    const played = playUntilDay(initialState(), 23, 42).state;
    expect(actualCurve(played)).toEqual(referenceCurve(makeOffers()));
  });
});
