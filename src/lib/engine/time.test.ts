import { describe, expect, it } from "vitest";
import { SIM_END, SIM_START, formatSim, formatSimShort, simAt, toSimDate } from "./time";

describe("simulated time axis", () => {
  it("J1 08:00 is minute 480 and is a Monday", () => {
    expect(SIM_START).toBe(480);
    expect(formatSim(SIM_START)).toBe("J1 · lun. 08:00");
  });

  it("R2 example 1: J2 (Tuesday) 10:03 = 2043", () => {
    expect(simAt(2, 10 * 60 + 3)).toBe(2043);
    expect(formatSimShort(2043 + 1440)).toBe("J3 10:03");
  });

  it("R2 example 2: J5 (Friday) 17:00 = 6780 and J6 (Monday) 08:00 = 10560", () => {
    expect(simAt(5, 17 * 60)).toBe(6780);
    expect(simAt(6, 8 * 60)).toBe(10560);
    expect(formatSim(10560)).toBe("J6 · lun. 08:00");
  });

  it("formats the top-bar label as in section 4", () => {
    expect(formatSim(simAt(3, 10 * 60 + 3))).toBe("J3 · mer. 10:03");
  });

  it("weekends have no business day index", () => {
    const saturday = 5 * 1440 + 600;
    expect(toSimDate(saturday).dayIndex).toBeNull();
    expect(formatSim(saturday)).toBe("Week-end · sam. 10:00");
  });

  it("J22 19:00 is the final bound (Tuesday of week 5)", () => {
    expect(formatSim(SIM_END)).toBe("J22 · mar. 19:00");
  });
});
