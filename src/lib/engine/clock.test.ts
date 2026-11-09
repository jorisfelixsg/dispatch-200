import { describe, expect, it } from "vitest";
import { advanceHours, endedBusinessDays, goToDayStart, isEndOfMonth, nextBusinessDay } from "./clock";
import { formatSim, SIM_END, simAt } from "./time";

describe("R13 — clock", () => {
  it("US-06: « +1h » at J4 18:30 → J5 08:00 (past 19:00, next business day at 08:00)", () => {
    expect(formatSim(advanceHours(simAt(4, 1110), 1))).toBe("J5 · ven. 08:00");
  });

  it("US-06: « Jour suivant » at J5 (Friday) 12:00 → J6 (Monday) 08:00", () => {
    expect(formatSim(nextBusinessDay(simAt(5, 720)))).toBe("J6 · lun. 08:00");
  });

  it("« +2h » inside the day moves two hours; reaching exactly 19:00 stays on the same day", () => {
    expect(advanceHours(simAt(3, 600), 2)).toBe(simAt(3, 720));
    expect(advanceHours(simAt(3, 1020), 2)).toBe(simAt(3, 1140));
    expect(advanceHours(simAt(3, 1021), 2)).toBe(simAt(4, 480));
  });

  it("J22 19:00 is the final bound: the clock stays there and shows « Fin du mois »", () => {
    expect(advanceHours(simAt(22, 1110), 1)).toBe(SIM_END);
    expect(nextBusinessDay(simAt(22, 600))).toBe(SIM_END);
    expect(advanceHours(SIM_END, 2)).toBe(SIM_END);
    expect(isEndOfMonth(SIM_END)).toBe(true);
    expect(isEndOfMonth(simAt(22, 1139))).toBe(false);
  });

  it("« Aller au début de Jx » never moves the clock backwards; J23 means the end of the month", () => {
    expect(goToDayStart(simAt(3, 600), 10)).toBe(simAt(10, 480));
    expect(goToDayStart(simAt(10, 600), 3)).toBe(simAt(10, 600));
    expect(goToDayStart(simAt(10, 600), 23)).toBe(SIM_END);
  });

  it("lists the business days left behind by a clock change (for R12)", () => {
    expect(endedBusinessDays(simAt(3, 600), simAt(4, 480))).toEqual([3]);
    expect(endedBusinessDays(simAt(3, 600), simAt(6, 480))).toEqual([3, 4, 5]);
    expect(endedBusinessDays(simAt(3, 600), simAt(3, 720))).toEqual([]);
  });
});
