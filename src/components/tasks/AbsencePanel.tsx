"use client";

import { useState } from "react";
import { CalendarX2 } from "lucide-react";
import { BUSINESS_DAYS } from "@/lib/engine/config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** R12 / US-14 — declare an absence for today or a future business day. */
export function AbsencePanel({
  today,
  absences,
  onDeclare,
}: {
  today: number | null;
  absences: number[];
  onDeclare: (dayIndex: number) => Promise<{ ok: boolean; message: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const choices = today === null ? [] : Array.from({ length: BUSINESS_DAYS - today + 1 }, (_, i) => today + i).filter((d) => !absences.includes(d));
  const selected = day !== null && choices.includes(day) ? day : choices[0];

  const submit = async () => {
    if (selected === undefined) return;
    setBusy(true);
    const r = await onDeclare(selected);
    setBusy(false);
    setMessage({ ok: r.ok, text: r.message });
    if (r.ok) setOpen(false);
  };

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="font-medium">Absences déclarées : </span>
          <span className="text-muted-foreground">{absences.length > 0 ? absences.map((d) => `J${d}`).join(", ") : "aucune"}</span>
        </p>
        {!open && (
          <Button variant="outline" onClick={() => { setOpen(true); setMessage(null); }} disabled={choices.length === 0}>
            <CalendarX2 aria-hidden /> Déclarer une absence
          </Button>
        )}
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="absence-day" className="text-sm">
            Absent le
          </label>
          <select
            id="absence-day"
            value={selected ?? ""}
            onChange={(e) => setDay(Number(e.target.value))}
            className="h-11 rounded-md border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {choices.map((d) => (
              <option key={d} value={d}>
                J{d}
                {d === today ? " (aujourd'hui)" : ""}
              </option>
            ))}
          </select>
          <Button onClick={() => void submit()} disabled={busy || selected === undefined}>
            Déclarer
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Annuler
          </Button>
          <p className="w-full text-xs text-muted-foreground">Ce jour-là, ton budget vaut 0 et aucune tâche ne t&apos;est proposée.</p>
        </div>
      )}
      {message && <p role="status" className={cn("text-sm", message.ok ? "text-ok" : "text-danger")}>{message.text}</p>}
    </div>
  );
}
