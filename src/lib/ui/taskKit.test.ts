import { describe, expect, it } from "vitest";
import { STEPS } from "@/lib/engine/config";
import { absoluteUrl, taskKit, whyItMatters, UNDO_DELAY_MS } from "./taskKit";

const task = {
  merchantName: "Savonnerie Tilleul",
  category: "Beauté",
  description: "Savonnerie Tilleul propose des soins naturels.",
  url: "https://demo.invalid/m/savonnerie-tilleul",
  imageUrl: "/media/image/5",
  logoUrl: "/media/logo/5",
};

describe("task kit (Mes tâches v2)", () => {
  it("keeps the undo delay chosen by the PM", () => {
    expect(UNDO_DELAY_MS).toBe(2000);
  });

  it("gives S2 the merchant name, category and website", () => {
    expect(taskKit({ ...task, step: "S2" }).fields.map((f) => f.value)).toEqual([
      "Savonnerie Tilleul",
      "Beauté",
      "https://demo.invalid/m/savonnerie-tilleul",
    ]);
  });

  it("gives S4 the logo as an image", () => {
    const logo = taskKit({ ...task, step: "S4" }).fields.find((f) => f.kind === "image");
    expect(logo?.value).toBe("/media/logo/5");
  });

  it("has a checklist only for S5", () => {
    for (const step of STEPS) {
      expect(taskKit({ ...task, step }).checklist.length > 0).toBe(step === "S5");
    }
  });

  it("never shows an empty field for any step", () => {
    for (const step of STEPS) {
      for (const f of taskKit({ ...task, step }).fields) expect(f.value).not.toBe("");
    }
  });

  it("names who is waiting, from the default skills", () => {
    expect(whyItMatters("S2")).toBe("Bob en a besoin pour ajouter le logo");
    expect(whyItMatters("S1")).toBe("Charlie en a besoin pour créer l'offre");
  });

  it("makes media paths absolute", () => {
    expect(absoluteUrl("/media/logo/5", "https://x.app")).toBe("https://x.app/media/logo/5");
    expect(absoluteUrl("https://demo.invalid/m/a", "https://x.app")).toBe("https://demo.invalid/m/a");
  });
});
