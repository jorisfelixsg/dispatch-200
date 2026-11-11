// Execution kit for « Mes tâches » v2 (PM decision 2026-11-11): what the contributor needs to do a
// step in the back-office, so they never have to look anything up.

import type { Step } from "@/lib/engine/config";
import { DEFAULT_PEOPLE } from "@/lib/engine/people";
import type { TaskView } from "@/lib/live/contracts";

/** How long the « Annuler » button stays before the step is sent to the server (PM: 2 s). */
export const UNDO_DELAY_MS = 2000;

/** Plain-language name of each step (from the case brief). */
export const STEP_NAMES: Readonly<Record<Step, string>> = {
  S1: "Préparer le contenu de l'offre",
  S2: "Créer le marchand",
  S3: "Créer l'offre",
  S4: "Ajouter le logo",
  S5: "Contrôler et publier",
};

export interface KitField {
  label: string;
  value: string;
  /** "image" fields show a thumbnail next to the value. */
  kind?: "text" | "image";
}

export interface TaskKit {
  fields: KitField[];
  /** Short quality checklist (S5 only). Informative: it does not block « Fait ». */
  checklist: string[];
}

/** Names of the people trained on a step by default, e.g. "Charlie" or "Bob et Charlie". */
function trainedOn(step: Step): string {
  const names = DEFAULT_PEOPLE.filter((p) => p.skills.includes(step)).map((p) => p.name);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

/** Why this task matters, said in human terms (what it unblocks and for whom, from R1 and R2). */
export function whyItMatters(step: Step): string {
  switch (step) {
    case "S1":
      return `${trainedOn("S3")} en a besoin pour créer l'offre`;
    case "S2":
      return `${trainedOn("S4")} en a besoin pour ajouter le logo`;
    case "S3":
      return "Après toi, il ne reste que le contrôle et la publication";
    case "S4":
      return "Lance le délai de 24h avant la publication";
    case "S5":
      return "Dernière étape : l'offre sera visible par les utilisateurs";
  }
}

/** Fields to copy into the back-office for one task, by step. */
export function taskKit(task: Pick<TaskView, "step" | "merchantName" | "category" | "description" | "url" | "imageUrl" | "logoUrl">): TaskKit {
  switch (task.step) {
    case "S1":
      return {
        fields: [
          { label: "Description de l'offre", value: task.description },
          { label: "Site du marchand", value: task.url },
          { label: "Image principale", value: task.imageUrl, kind: "image" },
        ],
        checklist: [],
      };
    case "S2":
      return {
        fields: [
          { label: "Nom du marchand", value: task.merchantName },
          { label: "Catégorie", value: task.category },
          { label: "Site web", value: task.url },
        ],
        checklist: [],
      };
    case "S3":
      return {
        fields: [
          { label: "Marchand", value: task.merchantName },
          { label: "Description", value: task.description },
          { label: "Lien du bouton", value: task.url },
          { label: "Image", value: task.imageUrl, kind: "image" },
        ],
        checklist: [],
      };
    case "S4":
      return {
        fields: [
          { label: "Marchand à retrouver", value: task.merchantName },
          { label: "Logo à ajouter", value: task.logoUrl, kind: "image" },
        ],
        checklist: [],
      };
    case "S5":
      return {
        fields: [
          { label: "Marchand", value: task.merchantName },
          { label: "Lien du bouton", value: task.url },
        ],
        checklist: ["Le logo s'affiche", "La description est sans faute", "Le bouton ouvre le bon site"],
      };
  }
}

/** Relative media paths (/media/logo/5) become absolute so they can be pasted elsewhere. */
export function absoluteUrl(value: string, origin: string): string {
  return value.startsWith("/") ? `${origin}${value}` : value;
}
