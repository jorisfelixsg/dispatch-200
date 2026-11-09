import { describe, expect, it } from "vitest";
import { applyAction } from "./actions";
import { RESERVATION_TTL_MS } from "./config";
import { computeTaskList, otherPossibleTasks, refreshTaskList, taskKey } from "./taskList";
import { exec, execRange, initialState, labels, session } from "./testing/fixtures";
import { simAt } from "./time";

describe("R5 — order of the « Mes tâches » list", () => {
  it("R5 example « Alice sans aide »: S2 r1, S1 r1, …, S2 r10, S1 r10 (60 min, 10 merchants)", () => {
    const list = computeTaskList(initialState(), "alice");
    const expected = Array.from({ length: 10 }, (_, i) => [`S2 r${i + 1}`, `S1 r${i + 1}`]).flat();
    expect(labels(list.tasks)).toEqual(expected);
    expect(list.tasks.reduce((s, t) => s + t.duration, 0)).toBe(60);
  });

  it("R5 example « Alice avec aide »: S1 r1–r40 done by Bob and Charlie at J1 → S2 r1 … S2 r20", () => {
    const state = initialState({
      nowSim: simAt(1, 600),
      executions: [...execRange(1, 20, ["S1"], simAt(1, 480), "bob"), ...execRange(21, 40, ["S1"], simAt(1, 480), "charlie")],
    });
    const list = computeTaskList(state, "alice");
    expect(labels(list.tasks)).toEqual(Array.from({ length: 20 }, (_, i) => `S2 r${i + 1}`));
  });

  it("R5 example « Bob à J2 »: 12 S4 ready, no S5 → 12 S4 (36 min) + 8 S1 (24 min)", () => {
    const state = initialState({ nowSim: simAt(2, 600), executions: execRange(1, 12, ["S2"]) });
    const list = computeTaskList(state, "bob");
    expect(labels(list.tasks)).toEqual([
      ...Array.from({ length: 12 }, (_, i) => `S4 r${i + 1}`),
      ...Array.from({ length: 8 }, (_, i) => `S1 r${i + 1}`),
    ]);
  });

  it("US-02: S4 tasks are sorted by S2 end time, not by rank", () => {
    // S2 done in reverse order: rank 12 first, rank 1 last.
    const executions = Array.from({ length: 12 }, (_, i) => exec(12 - i, "S2", simAt(1, 500 + i * 3)));
    const list = computeTaskList(initialState({ nowSim: simAt(2, 600), executions }), "bob");
    expect(labels(list.tasks.slice(0, 12))).toEqual(Array.from({ length: 12 }, (_, i) => `S4 r${12 - i}`));
  });

  it("US-02: a step outside the person's skills never appears", () => {
    const state = initialState({
      nowSim: simAt(5, 600),
      executions: [...execRange(1, 30, ["S1", "S2"]), ...execRange(31, 40, ["S1", "S2", "S3", "S4"], simAt(1, 480))],
    });
    expect(computeTaskList(state, "alice").tasks.every((t) => t.step === "S1" || t.step === "S2")).toBe(true);
    expect(computeTaskList(state, "bob").tasks.every((t) => ["S1", "S4", "S5"].includes(t.step))).toBe(true);
    expect(computeTaskList(state, "charlie").tasks.every((t) => ["S1", "S3", "S5"].includes(t.step))).toBe(true);
  });

  it("US-04: S5 is offered to nobody before 24h, then offered from J3 10:03", () => {
    const executions = [exec(3, "S1", 500), exec(3, "S2", 510), exec(3, "S3", 900), exec(3, "S4", simAt(2, 603), "bob")];
    const before = initialState({ nowSim: simAt(3, 600), executions });
    for (const p of ["bob", "charlie"] as const) {
      expect(computeTaskList(before, p).tasks.some((t) => t.step === "S5")).toBe(false);
    }
    const after = { ...before, nowSim: simAt(3, 603) };
    expect(labels(computeTaskList(after, "bob").tasks)[0]).toBe("S5 r3");
  });

  it("each task is flagged major or secondary", () => {
    const state = initialState({ nowSim: simAt(2, 600), executions: execRange(1, 12, ["S2"]) });
    const list = computeTaskList(state, "bob");
    expect(list.tasks[0]).toMatchObject({ step: "S4", major: true });
    expect(list.tasks[12]).toMatchObject({ step: "S1", major: false });
  });
});

describe("R4 — daily budget in the list", () => {
  it("R4 example: Charlie has 3 min left → the ready S3 (6 min) is skipped, the ready S5 (3 min) is offered", () => {
    const executions = [
      ...execRange(1, 1, ["S1", "S2"]),
      exec(2, "S1", 490), exec(2, "S2", 491), exec(2, "S3", 600, "charlie"), exec(2, "S4", 700, "bob"),
    ];
    const state = initialState({ nowSim: simAt(3, 600), executions, sessions: [session("charlie", 3, 57)] });
    const list = computeTaskList(state, "charlie");
    expect(list.remaining).toBe(3);
    expect(labels(list.tasks)).toEqual(["S5 r2"]);
  });

  it("a ready task that does not fit gives the « nothing fits » reason", () => {
    const state = initialState({
      nowSim: simAt(3, 600),
      executions: execRange(1, 1, ["S1", "S2"]),
      sessions: [session("charlie", 3, 57)],
      offers: [{ id: 1, rank: 1, importance: "A" }],
    });
    const list = computeTaskList(state, "charlie");
    expect(list.tasks).toEqual([]);
    expect(list.emptyReason).toBe("nothingFits");
  });
});

describe("R7 — reservations (no duplicate between lists)", () => {
  it("R7 example: at J1 08:00 Bob gets S1 r1–r20; Charlie, connecting next, gets S1 r21–r40", () => {
    const first = refreshTaskList(initialState(), "bob");
    expect(labels(first.list.tasks)).toEqual(Array.from({ length: 20 }, (_, i) => `S1 r${i + 1}`));
    const second = refreshTaskList(first.state, "charlie");
    expect(labels(second.list.tasks)).toEqual(Array.from({ length: 20 }, (_, i) => `S1 r${i + 21}`));
  });

  it("US-12: Bob and Charlie at J1 08:00 never share an S1 task", () => {
    const bob = refreshTaskList(initialState(), "bob");
    const charlie = refreshTaskList(bob.state, "charlie");
    const bobKeys = new Set(bob.list.tasks.map(taskKey));
    expect(charlie.list.tasks.some((t) => bobKeys.has(taskKey(t)))).toBe(false);
  });

  it("a reservation expires 60 s after the last heartbeat", () => {
    const bob = refreshTaskList(initialState(), "bob");
    const later = { ...bob.state, nowReal: bob.state.nowReal + RESERVATION_TTL_MS };
    expect(labels(computeTaskList(later, "charlie").tasks)[0]).toBe("S1 r1");
  });

  it("each recalculation replaces the person's own reservations", () => {
    const once = refreshTaskList(initialState(), "bob");
    const twice = refreshTaskList(once.state, "bob");
    expect(labels(twice.list.tasks)).toEqual(labels(once.list.tasks));
    expect(twice.state.reservations).toHaveLength(20);
  });
});

describe("R11 action 1 — forced mode in the list", () => {
  it("R11 example: Charlie forced on [S3] sees a single S3, never S5 nor S1", () => {
    const executions = [
      ...execRange(1, 10, ["S1", "S2"]),
      exec(11, "S1", 490), exec(11, "S2", 491), exec(11, "S3", 600, "charlie"), exec(11, "S4", 700, "bob"),
    ];
    const state = applyAction(initialState({ nowSim: simAt(3, 600), executions }), { type: "FORCE_ORDER", personId: "charlie" });
    expect(labels(computeTaskList(state, "charlie").tasks)).toEqual(["S3 r1"]);
  });

  it("forced on [S3] with no S3 ready: nothing is offered (the S5 stays hidden)", () => {
    const executions = [exec(11, "S1", 490), exec(11, "S2", 491), exec(11, "S3", 600, "charlie"), exec(11, "S4", 700, "bob")];
    const state = applyAction(initialState({ nowSim: simAt(3, 600), executions }), { type: "FORCE_ORDER", personId: "charlie" });
    expect(computeTaskList(state, "charlie").tasks).toEqual([]);
  });

  it("the next step of the sequence is offered only when no task of the previous step is ready", () => {
    const executions = [exec(11, "S1", 490), exec(11, "S2", 491), exec(11, "S3", 600, "charlie"), exec(11, "S4", 700, "bob")];
    const state = applyAction(initialState({ nowSim: simAt(3, 600), executions }), {
      type: "FORCE_ORDER", personId: "charlie", sequence: ["S3", "S5"],
    });
    expect(labels(computeTaskList(state, "charlie").tasks)).toEqual(["S5 r11"]);
  });
});

describe("R11 action 2 — the orchestrator's list with Renfort S1", () => {
  it("without reinforcement the orchestrator has no task; with it, S1 by rank within 60 min", () => {
    expect(computeTaskList(initialState(), "orchestrator").emptyReason).toBe("noSkills");
    const state = applyAction(initialState({ nowSim: simAt(10, 480) }), { type: "RENFORT_S1" });
    expect(labels(computeTaskList(state, "orchestrator").tasks)).toEqual(Array.from({ length: 20 }, (_, i) => `S1 r${i + 1}`));
  });
});

describe("US-13 — « Autres tâches possibles »", () => {
  it("lists ready tasks in the person's skills that are not in their list", () => {
    const state = initialState({ nowSim: simAt(2, 600), executions: execRange(1, 12, ["S2"]) });
    const list = computeTaskList(state, "bob");
    const others = otherPossibleTasks(state, "bob", list.tasks);
    expect(labels(others).slice(0, 2)).toEqual(["S1 r9", "S1 r10"]);
    expect(others).toHaveLength(200 - 8);
  });
});
