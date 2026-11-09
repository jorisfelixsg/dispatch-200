import { describe, expect, it } from "vitest";
import { declareAbsence } from "./absences";
import { projectEndOfMonth } from "./projection";
import { initialState } from "./testing/fixtures";

describe("US-17 — projection to J22", () => {
  it("from the initial state, without absence, every simulation publishes the 200 offers", () => {
    const p = projectEndOfMonth(initialState());
    expect(p).toMatchObject({ runs: 20, min: 200, median: 200, max: 200 });
  });

  it("long absences lower the projection", () => {
    let state = initialState();
    for (let d = 1; d <= 6; d++) {
      const r = declareAbsence(state, "charlie", d);
      if (r.ok) state = r.state;
    }
    expect(projectEndOfMonth(state).min).toBeLessThan(200);
  });
});
