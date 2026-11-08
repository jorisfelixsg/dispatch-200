import type { PersonId, Role } from "@/lib/engine/people";
import { getDefaultPerson } from "@/lib/engine/people";

export interface NavItem {
  href: string;
  label: string;
  /** Screen code from spec section 4. */
  code: string;
  roles: Role[];
}

// Screen map (spec section 4). A contributor sees E1 and E3; the orchestrator sees E2 to E6
// (and E1 when the "Renfort S1" action is active — wired in step 7).
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/tasks", label: "Mes tâches", code: "E1", roles: ["contributor"] },
  { href: "/control", label: "Tour de contrôle", code: "E2", roles: ["orchestrator"] },
  { href: "/offers", label: "Suivi des offres", code: "E3", roles: ["contributor", "orchestrator"] },
  { href: "/clock", label: "Horloge", code: "E4", roles: ["orchestrator"] },
  { href: "/team", label: "Équipe", code: "E5", roles: ["orchestrator"] },
  { href: "/log", label: "Journal", code: "E6", roles: ["orchestrator"] },
];

export function navItemsFor(profile: PersonId): NavItem[] {
  const role = getDefaultPerson(profile).role;
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function homePathFor(profile: PersonId): string {
  return getDefaultPerson(profile).role === "orchestrator" ? "/control" : "/tasks";
}

export function canAccess(profile: PersonId, pathname: string): boolean {
  return navItemsFor(profile).some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
