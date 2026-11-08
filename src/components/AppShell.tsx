"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/hooks/useProfile";
import { canAccess, homePathFor } from "@/lib/navigation";
import { HealthNotice } from "./HealthNotice";
import { TopBar } from "./TopBar";

/** Wraps every in-app screen: requires a chosen profile and enforces the per-role screen map. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const pathname = usePathname();
  const router = useRouter();

  const allowed = profile ? canAccess(profile, pathname) : false;

  useEffect(() => {
    if (profile === undefined) return; // not hydrated yet
    if (profile === null) router.replace("/");
    else if (!allowed) router.replace(homePathFor(profile));
  }, [profile, allowed, router]);

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
