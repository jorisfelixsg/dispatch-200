import { describe, expect, it } from "vitest";
import type { Step } from "./config";
import { isStepReady, isWaitingFor24h, offerPhase, s5AvailableAt, type StepMap } from "./offerStatus";
import { simAt } from "./time";
import type { StepExecution } from "./types";

function done(step: Step, doneAtSim: number): StepExecution {
  return { offerId: 1, step, doneBy: "bob", doneAtSim, doneAtReal: "", inPriority: true, source: "manual" };
}

describe("offer status (R1, R2)", () => {
  it("R1 example: S2 done, S1 not done → S4 ready, S3 not ready", () => {
    const steps: StepMap = { S2: done("S2", 600) };
    expect(isStepReady(steps, "S4", 700)).toBe(true);
    expect(isStepReady(steps, "S3", 700)).toBe(false);
  });

  it("R2 example 1: S4 at J2 10:03 → S5 possible from J3 10:03", () => {
    const steps: StepMap = {
      S1: done("S1", 500), S2: done("S2", 510), S3: done("S3", 900), S4: done("S4", simAt(2, 603)),
    };
    expect(s5AvailableAt(steps)).toBe(3483);
    expect(isStepReady(steps, "S5", simAt(3, 600))).toBe(false);
    expect(isWaitingFor24h(steps, simAt(3, 600))).toBe(true);
    expect(isStepReady(steps, "S5", simAt(3, 603))).toBe(true);
    expect(offerPhase(steps, simAt(3, 603))).toBe("inProgress");
  });

  it("R2 example 2: S4 on Friday 17:00 → S5 ready on Monday 08:00 (weekend counts)", () => {
    const steps: StepMap = {
      S1: done("S1", 500), S2: done("S2", 510), S3: done("S3", 900), S4: done("S4", 6780),
    };
    expect(isStepReady(steps, "S5", 10560)).toBe(true);
  });

  it("published once S5 is done", () => {
    expect(offerPhase({ S5: done("S5", 4000) }, 5000)).toBe("published");
    expect(offerPhase({}, 480)).toBe("notStarted");
  });
});
