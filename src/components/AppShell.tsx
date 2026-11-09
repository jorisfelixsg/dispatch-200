"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/hooks/useProfile";
import { useSimState } from "@/hooks/useSimState";
import { canAccess, homePathFor } from "@/lib/navigation";
import { HealthNotice } from "./HealthNotice";
import { TopBar } from "./TopBar";

/** Wraps every in-app screen: requires a chosen profile and enforces the per-role screen map. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const pathname = usePathname();
  const router = useRouter();

  const { state: sim, status: simStatus } = useSimState();
  const renfortActive = Boolean(sim?.renfort_s1?.active);
  const allowed = profile ? canAccess(profile, pathname, { renfortActive }) : false;
  // The orchestrator may open « Mes tâches » only with Renfort S1: wait for the shared state first.
  const waitingForSim = profile === "orchestrator" && pathname.startsWith("/tasks") && simStatus === "loading";

  useEffect(() => {
    if (profile === undefined || waitingForSim) return; // not hydrated yet
    if (profile === null) router.replace("/");
    else if (!allowed) router.replace(homePathFor(profile));
  }, [profile, allowed, router, waitingForSim]);

  const ready = Boolean(profile && allowed);

  // The page segment is always rendered (hidden until the profile is known) so Next.js can
  // prerender and validate it; the browser-only profile check only toggles visibility.
  return (
    <>
      {ready && profile ? <TopBar profile={profile} /> : null}
      {ready ? <HealthNotice /> : null}
      {!ready && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Chargement…</div>
      )}
      <main hidden={!ready} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {children}
      </main>
    </>
  );
}
