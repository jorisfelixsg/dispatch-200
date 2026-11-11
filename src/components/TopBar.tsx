"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Clock, LogOut } from "lucide-react";
import { useControlReport } from "@/hooks/useControlReport";
import { useProfile } from "@/hooks/useProfile";
import { useSimClock } from "@/hooks/useSimClock";
import { useSimState } from "@/hooks/useSimState";
import { getDefaultPerson, type PersonId } from "@/lib/engine/people";
import { formatSim } from "@/lib/engine/time";
import { navItemsFor, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { LevelPill } from "./LevelPill";
import { PersonAvatar } from "./PersonAvatar";

/** R10 — global level = worst of the five controls. Orchestrator only (PM decision 2026-11-10). */
function GlobalLevel() {
  const control = useControlReport();
  return <LevelPill level={control.payload?.level ?? null} />;
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-11 items-center gap-1.5 border-b-2 px-3 text-sm transition-colors",
        active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {item.label}
      {item.demo && (
        <span className="rounded border border-dashed border-muted-foreground/50 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Démo
        </span>
      )}
    </Link>
  );
}

export function TopBar({ profile }: { profile: PersonId }) {
  const person = getDefaultPerson(profile);
  const orchestrator = person.role === "orchestrator";
  const { nowSim } = useSimClock();
  const { setProfile } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const { state: sim } = useSimState();
  const items = navItemsFor(profile, { renfortActive: Boolean(sim?.renfort_s1?.active) });
  const productItems = items.filter((item) => !item.demo);
  const demoItems = items.filter((item) => item.demo);
  const isActive = (item: NavItem) => pathname === item.href || pathname.startsWith(`${item.href}/`);

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

        {/* Dashed border = demo scaffolding (simulated time). */}
        <div
          className="flex items-center gap-1.5 rounded-md border border-dashed border-muted-foreground/50 bg-muted px-2.5 py-1 font-mono text-sm tabular-nums"
          title="Heure simulée de la démo"
        >
          <Clock className="size-3.5 text-muted-foreground" aria-hidden />
          <span aria-label="Horloge simulée">{formatSim(nowSim)}</span>
        </div>

        {orchestrator && <GlobalLevel />}

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
        <ul className="flex min-w-max items-center gap-1">
          {productItems.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(item)} />
            </li>
          ))}
          {demoItems.length > 0 && <li aria-hidden className="mx-2 h-5 w-px bg-border" />}
          {demoItems.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(item)} />
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
