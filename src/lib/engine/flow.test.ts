import { describe, expect, it } from "vitest";
import { declareAbsence } from "./absences";
import { applyAction } from "./actions";
import { computeFlow, computeTeam } from "./flow";
import { exec, execRange, initialState, session } from "./testing/fixtures";
import { simAt } from "./time";

describe("Tower v2 — offers waiting in front of each step", () => {
  it("at the initial state, only S1 and S2 are ready (200 each)", () => {
    const flow = computeFlow(initialState());
    expect(flow.ready).toEqual({ S1: 200, S2: 200, S3: 0, S4: 0, S5: 0 });
    expect(flow.waiting24h).toBe(0);
  });

  it("counts S3 / S4 ready from their prerequisites, and S5 only after the 24h delay", () => {
    // Offers 1–3: S1 + S2 done. Offers 1–2: S3 + S4 done at J2 10:00; offer 1's S4 at J1 10:00.
    const executions = [
      ...execRange(1, 3, ["S1", "S2"]),
      exec(1, "S3", simAt(2, 600)),
      exec(1, "S4", simAt(1, 600)),
      exec(2, "S3", simAt(2, 600)),
      exec(2, "S4", simAt(2, 600)),
    ];
    const flow = computeFlow(initialState({ nowSim: simAt(2, 700), executions }));
    expect(flow.ready.S3).toBe(1); // offer 3
    expect(flow.ready.S4).toBe(1); // offer 3
    expect(flow.ready.S5).toBe(1); // offer 1 (24h elapsed)
    expect(flow.waiting24h).toBe(1); // offer 2
  });

  it("lists who can do each step, including the orchestrator once the S1 reinforcement is on", () => {
    expect(computeFlow(initialState()).skilled).toEqual({
      S1: ["alice", "bob", "charlie"],
      S2: ["alice"],
      S3: ["charlie"],
      S4: ["bob"],
      S5: ["bob", "charlie"],
    });
    const renfort = applyAction(initialState(), { type: "RENFORT_S1" });
    expect(computeFlow(renfort).skilled.S1).toContain("orchestrator");
  });
});

describe("Tower v2 — the team today", () => {
  it("gives today's budget and consumption, the last step done and the absence days", () => {
    let state = initialState({
      nowSim: simAt(7, 600),
      executions: [exec(1, "S2", simAt(6, 965), "alice")],
      sessions: [session("alice", 7, 42)],
    });
    for (const d of [5, 6]) {
      // Absences must be declared on or before the day: declare them from J5.
      const r = declareAbsence({ ...state, nowSim: simAt(5, 480) }, "charlie", d);
      if (r.ok) state = { ...r.state, nowSim: state.nowSim };
    }
    const team = computeTeam(state);
    expect(team.map((m) => m.personId)).toEqual(["alice", "bob", "charlie"]);
    expect(team[0]).toMatchObject({ budget: 60, consumed: 42, absentToday: false, lastDoneSim: simAt(6, 965), absentDays: [] });
    expect(team[2]).toMatchObject({ consumed: 0, lastDoneSim: null, absentDays: [5, 6] });
  });

  it("a person declared absent today has a zero budget", () => {
    const r = declareAbsence(initialState({ nowSim: simAt(3, 600) }), "bob", 3);
    if (!r.ok) throw new Error(r.error);
    expect(computeTeam(r.state)[1]).toMatchObject({ personId: "bob", budget: 0, absentToday: true });
  });

  it("the orchestrator appears only with the S1 reinforcement", () => {
    const renfort = applyAction(initialState(), { type: "RENFORT_S1" });
    expect(computeTeam(renfort).map((m) => m.personId)).toContain("orchestrator");
  });
});
