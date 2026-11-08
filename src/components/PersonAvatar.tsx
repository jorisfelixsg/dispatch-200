import type { PersonId } from "@/lib/engine/people";
import { cn } from "@/lib/utils";

const COLOR_VAR: Record<PersonId, string> = {
  alice: "var(--person-alice)",
  bob: "var(--person-bob)",
  charlie: "var(--person-charlie)",
  orchestrator: "var(--person-orchestrator)",
};

export function personColor(id: PersonId): string {
  return COLOR_VAR[id];
}

export function PersonAvatar({
  id,
  name,
  className,
}: {
  id: PersonId;
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
        className,
      )}
      style={{ backgroundColor: COLOR_VAR[id] }}
    >
      {name.charAt(0)}
    </span>
  );
}
