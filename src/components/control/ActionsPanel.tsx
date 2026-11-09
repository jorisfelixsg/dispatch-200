"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ActionProposal, ActionType } from "@/lib/engine/actions";
import { BUSINESS_DAYS } from "@/lib/engine/config";
import { getDefaultPerson, type PersonId } from "@/lib/engine/people";
import type { ControlPayload } from "@/lib/live/contracts";
import { applyActionRequest } from "@/lib/live/actionsClient";
import { ACTION_TITLES, describeAction } from "@/lib/ui/actionLabels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CONTRIBUTORS: PersonId[] = ["alice", "bob", "charlie"];

const EFFECTS: Record<ActionType, string> = {
  FORCE_ORDER: "La personne ne voit plus qu'une tâche à la fois, uniquement sa tâche majeure.",
  RENFORT_S1: "L'orchestrateur reçoit la compétence S1 et 60 min par jour à partir d'aujourd'hui ; le mode auto le joue aussi.",
  EXTRA_HOUR: "+60 min de budget pour une personne, un jour donné.",
  RERANK: "Les marchands A passent en tête (rangs 1 à 40), puis B, puis C, dans l'ordre d'origine.",
};

const selectClass =
  "h-11 rounded-md border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ProposalCard({ index, proposal, payload }: { index: number; proposal: ActionProposal; payload: ControlPayload }) {
  const [personId, setPersonId] = useState<PersonId | "">(proposal.personId ?? "");
  const [day, setDay] = useState<number | null>(proposal.dayIndex);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const today = payload.today ?? 1;
  const needsPerson = proposal.type === "FORCE_ORDER" || proposal.type === "EXTRA_HOUR";
  const days = Array.from({ length: BUSINESS_DAYS - today + 1 }, (_, i) => today + i);
  const selectedDay = day !== null && day >= today ? day : today;

  const alreadyActive =
    (proposal.type === "RENFORT_S1" && payload.renfortActive) ||
    (proposal.type === "RERANK" && payload.activeActions.some((a) => a.type === "RERANK")) ||
    (proposal.type === "FORCE_ORDER" && personId !== "" && payload.forcedPeople.includes(personId));

  const apply = async () => {
    setBusy(true);
    setMessage(null);
    const r = await applyActionRequest(
      proposal.type,
      needsPerson ? (personId || null) : null,
      proposal.type === "EXTRA_HOUR" ? selectedDay : null,
    );
    setBusy(false);
    setMessage(r.ok ? { ok: true, text: "Action appliquée : listes et contrôles recalculés." } : { ok: false, text: r.message });
  };

  return (
    <li className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm">{index}</span>
        <div className="min-w-0">
          <p className="font-medium">{ACTION_TITLES[proposal.type]}</p>
          <p className="text-sm text-muted-foreground">{EFFECTS[proposal.type]}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-10">
        {needsPerson && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{proposal.personId ? "Personne concernée" : "Personne (à choisir)"}</span>
            <select value={personId} onChange={(e) => setPersonId(e.target.value as PersonId)} className={selectClass}>
              <option value="" disabled>
                Choisir…
              </option>
              {CONTRIBUTORS.map((id) => (
                <option key={id} value={id}>
                  {getDefaultPerson(id).name}
                </option>
              ))}
            </select>
          </label>
        )}
        {proposal.type === "EXTRA_HOUR" && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Jour</span>
            <select value={selectedDay} onChange={(e) => setDay(Number(e.target.value))} className={selectClass}>
              {days.map((d) => (
                <option key={d} value={d}>
                  J{d}
                  {d === today ? " (aujourd'hui)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button onClick={() => void apply()} disabled={busy || alreadyActive || (needsPerson && personId === "")}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {alreadyActive ? "Déjà active" : "Appliquer"}
        </Button>
      </div>

      {message && <p role="status" className={cn("pl-10 text-sm", message.ok ? "text-ok" : "text-danger")}>{message.text}</p>}
    </li>
  );
}

/** R11 / US-10 — catch-up actions, proposed when the global level is orange or red. */
export function ActionsPanel({ payload }: { payload: ControlPayload }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Actions de rattrapage</h2>
      {payload.proposals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
          Niveau global Vert : aucune action n&apos;est proposée.
        </p>
      ) : (
        <ol className="space-y-2">
          {payload.proposals.map((p, i) => (
            <ProposalCard key={`${p.type}:${p.personId ?? ""}:${p.dayIndex ?? ""}`} index={i + 1} proposal={p} payload={payload} />
          ))}
        </ol>
      )}

      {payload.activeActions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="font-medium">Actions actives</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {payload.activeActions.map((a) => (
              <li key={a.id}>
                {ACTION_TITLES[a.type]} : {describeAction(a.type, a.params)}
              </li>
            ))}
          </ul>
          <Link href="/team" className="mt-2 inline-block font-medium underline">
            Annuler une action (écran Équipe)
          </Link>
        </div>
      )}
    </div>
  );
}
