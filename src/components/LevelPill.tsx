"use client";

import type { Level } from "@/lib/engine/controls";
import { cn } from "@/lib/utils";

export const LEVEL_LABEL: Record<Level, string> = { green: "Vert", orange: "Orange", red: "Rouge" };

const DOT: Record<Level, string> = { green: "bg-ok", orange: "bg-warn", red: "bg-danger" };
const TEXT: Record<Level, string> = { green: "text-ok", orange: "text-warn", red: "text-danger" };
const BORDER: Record<Level, string> = { green: "border-ok/40", orange: "border-warn/40", red: "border-danger/40" };

/** R10 — level pill (green / orange / red), or a neutral dash while unknown. */
export function LevelPill({ level, prefix = "Niveau", className }: { level: Level | null; prefix?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        level ? cn(BORDER[level], TEXT[level]) : "border-border text-muted-foreground",
        className,
      )}
    >
      <span className={cn("size-2 rounded-full", level ? DOT[level] : "bg-muted-foreground/40")} aria-hidden />
      {prefix} {level ? LEVEL_LABEL[level] : "—"}
    </span>
  );
}
