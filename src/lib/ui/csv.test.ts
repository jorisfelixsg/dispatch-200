import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("US-19 — CSV export", () => {
  it("uses semicolons and quotes cells that need it", () => {
    expect(toCsv(["Rang", "Marchand"], [[1, "Café; Thé"], [2, 'Le "Bon" Goût']])).toBe(
      'Rang;Marchand\r\n1;"Café; Thé"\r\n2;"Le ""Bon"" Goût"',
    );
  });
});
