// French labels for the catch-up actions (R11), shared by the tower, the team screen and the log.

import type { ActionType } from "@/lib/engine/actions";
import { getDefaultPerson, isPersonId } from "@/lib/engine/people";

export const ACTION_TITLES: Record<ActionType | "TRAIN_BACKUP", string> = {
  FORCE_ORDER: "Forcer l'ordre",
  RENFORT_S1: "Renfort externe sur S1",
  TRAIN_BACKUP: "Former un remplaçant",
  EXTRA_HOUR: "Heure exceptionnelle",
  RERANK: "Prioriser les marchands importants",
};

function nameOf(id: unknown): string {
  return isPersonId(id) ? getDefaultPerson(id).name : "?";
}

/** One-line description of an applied action, from its stored params. */
export function describeAction(type: string, params: Record<string, unknown>): string {
  switch (type) {
    case "FORCE_ORDER": {
      const id = params.personId;
      const major = isPersonId(id) ? getDefaultPerson(id).majorStep : null;
      return `${nameOf(id)} : une seule tâche à la fois, uniquement ${major ?? "sa tâche majeure"}`;
    }
    case "RENFORT_S1":
      return `L'orchestrateur fait des S1, 60 min par jour${typeof params.sinceDay === "number" ? ` depuis J${params.sinceDay}` : ""}`;
    case "EXTRA_HOUR":
      return `${nameOf(params.personId)} : +60 min le J${String(params.dayIndex ?? "?")}`;
    case "RERANK":
      return "Marchands A en tête, puis B, puis C";
    default:
      return type;
  }
}
