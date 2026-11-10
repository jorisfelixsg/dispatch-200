import type { Step } from "@/lib/engine/config";

/** Plain-language name of each step (from the case brief). */
export const STEP_NAMES: Readonly<Record<Step, string>> = {
  S1: "Préparer le contenu de l'offre",
  S2: "Créer le marchand",
  S3: "Créer l'offre",
  S4: "Ajouter le logo",
  S5: "Contrôler et publier",
};

/** Prerequisites of each step (R1, R2), in plain language. */
export const STEP_PREREQUISITES: Readonly<Record<Step, string>> = {
  S1: "—",
  S2: "—",
  S3: "S1 et S2",
  S4: "S2",
  S5: "S3 et S4, 24h après S4",
};
