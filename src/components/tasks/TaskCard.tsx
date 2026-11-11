"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Copy, Undo2 } from "lucide-react";
import type { TaskView } from "@/lib/live/contracts";
import { absoluteUrl, STEP_NAMES, taskKit, UNDO_DELAY_MS, whyItMatters, type KitField } from "@/lib/ui/taskKit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

async function writeClipboard(text: string, doc: Document): Promise<boolean> {
  try {
    await doc.defaultView?.navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** One field of the execution kit, with a one-click copy. */
function KitRow({ field, compact }: { field: KitField; compact: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const doc = e.currentTarget.ownerDocument;
    const value = absoluteUrl(field.value, doc.defaultView?.location.origin ?? window.location.origin);
    if (await writeClipboard(value, doc)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={(e) => void copy(e)}
        className="flex min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-background px-2 text-left text-xs"
      >
        <span className="truncate">
          <span className="text-muted-foreground">{field.label} · </span>
          {field.value}
        </span>
        <span className={cn("shrink-0 font-semibold", copied ? "text-ok" : "text-primary")}>{copied ? "Copié" : "Copier"}</span>
      </button>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-lg border border-border px-3 py-2">
      <span className="col-span-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{field.label}</span>
      <span className="flex min-w-0 items-center gap-2 text-sm break-words">
        {field.kind === "image" && <Image src={field.value} alt="" width={32} height={32} unoptimized className="size-8 shrink-0 rounded-md" />}
        <span className="min-w-0 break-all">{field.value}</span>
      </span>
      <Button variant="outline" size="sm" onClick={(e) => void copy(e)} className={cn("h-11 sm:h-8", copied && "border-ok text-ok")}>
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? "Copié" : "Copier"}
      </Button>
    </div>
  );
}

/**
 * Piste 1 + 2 — the single task card with its execution kit. `compact` is the mini-window version.
 * With `onUndo`, the task was just marked done: the card stays, « Annuler » replaces « Fait ».
 */
export function TaskCard({
  task,
  onDone,
  onUndo,
  disabled,
  compact = false,
}: {
  task: TaskView;
  onDone: () => void;
  onUndo?: () => void;
  disabled: boolean;
  compact?: boolean;
}) {
  const kit = taskKit(task);
  const fields = compact ? kit.fields.filter((f) => f.kind !== "image").slice(0, 3) : kit.fields;

  return (
    <div className={cn("grid gap-3", !compact && "rounded-2xl border border-border bg-card p-4 sm:p-5")}>
      <div className="flex min-w-0 items-center gap-3">
        <Image
          src={task.logoUrl}
          alt=""
          width={52}
          height={52}
          unoptimized
          className={cn("shrink-0 rounded-xl", compact ? "size-9" : "size-13")}
        />
        <div className="grid min-w-0">
          <span className="flex flex-wrap items-center gap-2 font-mono text-xs font-semibold text-primary">
            {task.step} · {STEP_NAMES[task.step]}
            {onUndo && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 font-sans text-ok">
                <Check className="size-3" aria-hidden /> Faite
              </span>
            )}
          </span>
          <span className={cn("truncate font-semibold", compact ? "text-base" : "text-xl")}>{task.merchantName}</span>
          {!compact && <span className="text-sm text-muted-foreground">{whyItMatters(task.step)}</span>}
        </div>
      </div>

      <div className={cn("grid", compact ? "gap-1.5" : "gap-2")}>
        {fields.map((f) => (
          <KitRow key={f.label} field={f} compact={compact} />
        ))}
      </div>

      {!compact && kit.checklist.length > 0 && (
        <ul className="grid gap-1 text-sm">
          {kit.checklist.map((item) => (
            <li key={item}>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4" /> {item}
              </label>
            </li>
          ))}
        </ul>
      )}

      {onUndo ? (
        <UndoButton onUndo={onUndo} compact={compact} />
      ) : (
        <Button onClick={onDone} disabled={disabled} className={cn("w-full", compact ? "h-11" : "h-13 text-base")}>
          <Check aria-hidden />
          {compact ? "Fait, suivante" : "Fait"}
          <kbd className="ml-1 rounded border border-current px-1.5 font-mono text-[10px] opacity-70">Entrée</kbd>
        </Button>
      )}
    </div>
  );
}

/** « Annuler » button that drains like a red progress bar, then disappears (PM: 2 s). */
export function UndoButton({ onUndo, compact = false }: { onUndo: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onUndo}
      className={cn(
        "relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg border border-danger/40 bg-card font-semibold text-danger",
        compact ? "h-11 text-sm" : "h-13 text-base",
      )}
    >
      <span
        aria-hidden
        className="undo-drain absolute inset-0 bg-danger/15"
        style={{ animationDuration: `${UNDO_DELAY_MS}ms` }}
      />
      <span
        aria-hidden
        className="undo-drain absolute inset-x-0 bottom-0 h-1 bg-danger"
        style={{ animationDuration: `${UNDO_DELAY_MS}ms` }}
      />
      <Undo2 className="relative size-4" aria-hidden />
      <span className="relative">Annuler</span>
    </button>
  );
}
