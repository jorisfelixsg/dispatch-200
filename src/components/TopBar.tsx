"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Clock, LogOut } from "lucide-react";
import { useControlReport } from "@/hooks/useControlReport";
import { useProfile } from "@/hooks/useProfile";
import { useSimClock } from "@/hooks/useSimClock";
import { getDefaultPerson, type PersonId } from "@/lib/engine/people";
import { formatSim } from "@/lib/engine/time";
import { navItemsFor } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { LevelPill } from "./LevelPill";
import { PersonAvatar } from "./PersonAvatar";

export function TopBar({ profile }: { profile: PersonId }) {
  const person = getDefaultPerson(profile);
  const { nowSim } = useSimClock();
  const { setProfile } = useProfile();
  const control = useControlReport();
  const pathname = usePathname();
  const router = useRouter();
  const items = navItemsFor(profile);

  const changeProfile = () => {
    setProfile(null);
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <PersonAvatar id={profile} name={person.name} className="size-8" />
          <span className="truncate font-semibold">{person.name}</span>
        </div>

        <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 font-mono text-sm tabular-nums">
          <Clock className="size-3.5 text-muted-foreground" aria-hidden />
          <span aria-label="Horloge simulée">{formatSim(nowSim)}</span>
        </div>

        {/* R10 — global level = worst of the five controls. */}
        <LevelPill level={control.payload?.level ?? null} />

        <button
          type="button"
          onClick={changeProfile}
          className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden />
          Changer de profil
        </button>
      </div>

      <nav aria-label="Écrans" className="mx-auto max-w-7xl overflow-x-auto px-2">
        <ul className="flex min-w-max gap-1">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-11 items-center border-b-2 px-3 text-sm transition-colors",
                    active
                      ? "border-primary font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
