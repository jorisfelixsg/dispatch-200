import type { PersonId, Role } from "@/lib/engine/people";
import { getDefaultPerson } from "@/lib/engine/people";

export interface NavItem {
  href: string;
  label: string;
  /** Screen code from spec section 4. */
  code: string;
  roles: Role[];
  /** Demo scaffolding (simulated time, auto mode, reset), shown apart from the product screens. */
  demo?: boolean;
}

// Screen map (spec section 4, adjusted by the PM on 2026-11-10). A contributor sees only E1. The
// orchestrator sees E2, E3, E5, E6 and the E4 simulation screen, plus E1 when "Renfort S1" is active.
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/tasks", label: "Mes tâches", code: "E1", roles: ["contributor"] },
  { href: "/control", label: "Tour de contrôle", code: "E2", roles: ["orchestrator"] },
  { href: "/offers", label: "Suivi des offres", code: "E3", roles: ["orchestrator"] },
  { href: "/team", label: "Organisation", code: "E5", roles: ["orchestrator"] },
  { href: "/log", label: "Journal", code: "E6", roles: ["orchestrator"] },
  { href: "/clock", label: "Simulation", code: "E4", roles: ["orchestrator"], demo: true },
];

export interface NavOptions {
  /** R11 action 2 — the orchestrator also gets « Mes tâches ». */
  renfortActive?: boolean;
}

export function navItemsFor(profile: PersonId, options: NavOptions = {}): NavItem[] {
  const role = getDefaultPerson(profile).role;
  return NAV_ITEMS.filter(
    (item) => item.roles.includes(role) || (role === "orchestrator" && item.href === "/tasks" && options.renfortActive),
  );
}

export function homePathFor(profile: PersonId): string {
  return getDefaultPerson(profile).role === "orchestrator" ? "/control" : "/tasks";
}

export function canAccess(profile: PersonId, pathname: string, options: NavOptions = {}): boolean {
  return navItemsFor(profile, options).some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
