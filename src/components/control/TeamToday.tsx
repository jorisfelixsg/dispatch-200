"use client";

import { BUSINESS_DAYS } from "@/lib/engine/config";
import { concernedPerson } from "@/lib/engine/actions";
import { getDefaultPerson } from "@/lib/engine/people";
import { formatMinuteOfDay, formatSimShort, toSimDate } from "@/lib/engine/time";
import type { TeamMember } from "@/lib/engine/flow";
import type { ControlPayload } from "@/lib/live/contracts";
import { absenceNote } from "@/lib/ui/towerText";
import { PersonAvatar } from "@/components/PersonAvatar";
import { cn } from "@/lib/utils";

function status(m: TeamMember, today: number): string {
  if (m.absentToday) return "Absence déclarée aujourd'hui";
  const last = m.lastDoneSim === null ? null : toSimDate(m.lastDoneSim);
  if (m.consumed === 0) {
    return last && last.dayIndex !== today
      ? `Pas encore commencé aujourd'hui · dernière étape ${formatSimShort(m.lastDoneSim!)}`
      : "Pas encore commencé aujourd'hui";
  }
  if (m.consumed >= m.budget) return "Heure du jour faite";
  return last ? `En cours · dernière étape à ${formatMinuteOfDay(last.minuteOfDay)}` : "En cours";
}

/** Tower v2 — how each person's day is going (R4, R12); the person everything depends on comes first. */
export function TeamToday({ payload }: { payload: ControlPayload }) {
  const today = payload.today ?? BUSINESS_DAYS;
  const key = payload.level === "green" ? null : concernedPerson(payload.controls);
  const members = [...payload.team].sort((a, b) => Number(b.personId === key) - Number(a.personId === key));
  const upcoming = payload.team.some((m) => m.absentDays.some((d) => d > today));

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 md:p-5">
      <h2 className="text-lg font-semibold">L&apos;équipe aujourd&apos;hui</h2>
      <ul className="space-y-1">
        {members.map((m) => {
          const name = getDefaultPerson(m.personId).name;
          const note = absenceNote(m.absentDays.filter((d) => d !== today), today);
          const pct = m.budget > 0 ? Math.min(100, (m.consumed / m.budget) * 100) : 0;
          return (
            <li
              key={m.personId}
              className={cn("grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-1.5", m.personId === key && "bg-danger/10")}
            >
              <PersonAvatar id={m.personId} name={name} className={cn(m.consumed === 0 && "opacity-50")} />
              <div className="min-w-0 text-sm">
                <p>
                  <b className="font-medium">{name}</b>
                  {m.personId === key && <span className="text-danger"> · tout dépend de cette personne</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {status(m, today)}
                  {note ? ` · ${note}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </span>
                <span className="font-mono text-xs tabular-nums" title="Minutes faites aujourd'hui sur le budget du jour">
                  {m.consumed}/{m.budget}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {!upcoming && <p className="text-xs text-muted-foreground">Aucune absence prévue d&apos;ici le J{BUSINESS_DAYS}.</p>}
    </section>
  );
}
