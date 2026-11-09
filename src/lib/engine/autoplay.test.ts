import { describe, expect, it } from "vitest";
import { declareAbsence } from "./absences";
import { applyAction } from "./actions";
import { planSessions, playCurrentDay, playUntilDay, publishedCount, referenceCurve, dayRng } from "./autoplay";
import { initialState, makeOffers } from "./testing/fixtures";
import { formatSim, SIM_END, simAt, toSimDate } from "./time";

const minuteOf = (sim: number) => toSimDate(sim).minuteOfDay;

describe("R14 — auto mode: connection times", () => {
  it("each contributor with budget gets one session between 08:00 and 18:00; the orchestrator has none", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const plans = planSessions(initialState(), dayRng(seed, 1));
      expect(plans.map((p) => p.personId).sort()).toEqual(["alice", "bob", "charlie"]);
      for (const p of plans) expect(minuteOf(p.connectAt)).toBeGreaterThanOrEqual(480);
      for (const p of plans) expect(minuteOf(p.connectAt)).toBeLessThanOrEqual(1080);
      expect(plans.map((p) => p.connectAt)).toEqual([...plans.map((p) => p.connectAt)].sort((a, b) => a - b));
    }
  });

  it("PM decision: started at 14:00, connections are drawn between 14:00 and 18:00", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const p of planSessions(initialState({ nowSim: simAt(3, 840) }), dayRng(seed, 3))) {
        expect(minuteOf(p.connectAt)).toBeGreaterThanOrEqual(840);
        expect(minuteOf(p.connectAt)).toBeLessThanOrEqual(1080);
      }
    }
  });

  it("PM decision: with a 120 min budget the latest connection is 17:00 (the session ends by 19:00)", () => {
    const state = applyAction(initialState({ nowSim: simAt(3, 480) }), { type: "EXTRA_HOUR", personId: "charlie", dayIndex: 3 });
    for (let seed = 1; seed <= 50; seed++) {
      const charlie = planSessions(state, dayRng(seed, 3)).find((p) => p.personId === "charlie");
      expect(charlie?.remaining).toBe(120);
      expect(minuteOf(charlie!.connectAt)).toBeLessThanOrEqual(1020);
    }
  });

  it("PM decision: after 18:00 everyone connects at the current time", () => {
    const plans = planSessions(initialState({ nowSim: simAt(3, 1110) }), dayRng(7, 3));
    expect(plans.every((p) => p.connectAt === simAt(3, 1110))).toBe(true);
  });

  it("an absent contributor does not play", () => {
    const r = declareAbsence(initialState(), "bob", 1);
    if (!r.ok) throw new Error(r.error);
    expect(planSessions(r.state, dayRng(42, 1)).map((p) => p.personId)).not.toContain("bob");
  });

  it("with Renfort S1 the orchestrator plays as a 4th contributor (S1 only)", () => {
    const state = applyAction(initialState(), { type: "RENFORT_S1" });
    const result = playCurrentDay(state, 42);
    const mine = result.executions.filter((e) => e.doneBy === "orchestrator");
    expect(mine.length).toBe(20);
    expect(mine.every((e) => e.step === "S1")).toBe(true);
  });
});

describe("R14 — auto mode: playing days", () => {
  it("US-07: from the initial state with seed 42, « Jouer jusqu'au début de J10 » plays J1–J9 and stops at J10 08:00", () => {
    const result = playUntilDay(initialState(), 10, 42);
    expect(result.daysPlayed).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(formatSim(result.state.nowSim)).toBe("J10 · ven. 08:00");
    expect(result.executions.length).toBeGreaterThan(0);
    expect(result.executions.every((e) => e.source === "auto")).toBe(true);
    // One journal entry per step done, marked auto.
    const stepEvents = result.events.filter((e) => e.type === "STEP_DONE");
    expect(stepEvents).toHaveLength(result.executions.length);
    expect(stepEvents.every((e) => e.payload.source === "auto")).toBe(true);
  });

  it("each contributor uses at most their 60 min per day, and every step ends by 19:00", () => {
    const result = playUntilDay(initialState(), 23, 42);
    for (const s of result.state.sessions) expect(s.consumedMin).toBeLessThanOrEqual(60);
    for (const e of result.executions) expect(minuteOf(e.doneAtSim)).toBeLessThanOrEqual(1140);
  });

  it("US-07: same seed and same starting state → exactly the same result (determinism)", () => {
    const a = playUntilDay(initialState(), 10, 1234);
    const b = playUntilDay(initialState(), 10, 1234);
    expect(b.executions).toEqual(a.executions);
    const c = playUntilDay(initialState(), 10, 4321);
    expect(c.executions).not.toEqual(a.executions);
  });

  it("playing day by day gives the same result as one run", () => {
    let state = initialState();
    for (let d = 1; d <= 5; d++) state = playCurrentDay(state, 99).state;
    expect(state.executions).toEqual(playUntilDay(initialState(), 6, 99).state.executions);
  });

  it("« Jouer la journée en cours » started at 14:00 never moves the clock back", () => {
    const result = playCurrentDay(initialState({ nowSim: simAt(1, 840) }), 42);
    expect(result.executions.every((e) => e.doneAtSim > simAt(1, 840))).toBe(true);
    expect(result.state.nowSim).toBe(simAt(2, 480));
  });

  it("at the end of each day, a contributor who did nothing is detected absent (R12)", () => {
    // Everybody is busy on J1, so nobody is detected.
    expect(playCurrentDay(initialState(), 42).events.some((e) => e.type === "ABSENCE_DETECTED")).toBe(false);
  });

  it("nothing is played once the end of the month is reached", () => {
    const result = playCurrentDay(initialState({ nowSim: SIM_END }), 42);
    expect(result.executions).toEqual([]);
    expect(result.state.nowSim).toBe(SIM_END);
  });
});

describe("R14 — reference test", () => {
  it("from the initial state, without absence, for 50 seeds, the 200 offers are published by J22 19:00", () => {
    const failing: { seed: number; published: number }[] = [];
    for (let seed = 1; seed <= 50; seed++) {
      const result = playUntilDay(initialState(), 23, seed);
      const published = publishedCount(result.state);
      if (published < 200) failing.push({ seed, published });
    }
    expect(failing).toEqual([]);
  }, 300_000);
});

describe("R15 — reference trajectory", () => {
  it("stores the cumulative published offers at the end of J1…J22 (seed 42), ending at 200", () => {
    const curve = referenceCurve(makeOffers());
    expect(curve).toHaveLength(22);
    expect(curve.every((v, i) => i === 0 || v >= curve[i - 1])).toBe(true);
    expect(curve[21]).toBe(200);
  });

  it("is deterministic", () => {
    expect(referenceCurve(makeOffers())).toEqual(referenceCurve(makeOffers()));
  });
});
