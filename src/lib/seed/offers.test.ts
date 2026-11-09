import { describe, expect, it } from "vitest";
import { generateOffers, slugify } from "./offers";

describe("fictitious offers seed (section 5)", () => {
  const offers = generateOffers();

  it("creates 200 offers with rank = id", () => {
    expect(offers).toHaveLength(200);
    offers.forEach((o, i) => {
      expect(o.id).toBe(i + 1);
      expect(o.rank).toBe(o.id);
    });
  });

  it("has 40 A, 80 B and 80 C", () => {
    const count = (imp: string) => offers.filter((o) => o.importance === imp).length;
    expect([count("A"), count("B"), count("C")]).toEqual([40, 80, 80]);
  });

  it("has unique merchant names and slugs", () => {
    expect(new Set(offers.map((o) => o.merchantName)).size).toBe(200);
    expect(new Set(offers.map((o) => o.slug)).size).toBe(200);
  });

  it("uses demo.invalid URLs and local SVG media only", () => {
    for (const o of offers) {
      expect(o.url).toBe(`https://demo.invalid/m/${o.slug}`);
      expect(o.logoUrl).toBe(`/media/logo/${o.id}`);
      expect(o.imageUrl).toBe(`/media/image/${o.id}`);
    }
  });

  it("has a category and a 1–2 sentence description", () => {
    for (const o of offers) {
      expect(o.category.length).toBeGreaterThan(0);
      const sentences = o.description.split(". ").length;
      expect(sentences).toBeGreaterThanOrEqual(1);
      expect(sentences).toBeLessThanOrEqual(2);
    }
  });

  it("is deterministic", () => {
    expect(generateOffers()).toEqual(offers);
  });

  it("slugifies French names", () => {
    expect(slugify("Épicerie de l'Abbaye")).toBe("epicerie-de-l-abbaye");
  });
});
