"use client";

import { useEffect, useState } from "react";
import { isPersonId, PERSON_IDS, type PersonId } from "@/lib/engine/people";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/**
 * US-20 — profiles with an open screen, via Supabase Realtime presence. The current profile is
 * announced while the hook is mounted. Returns null when presence is unavailable.
 */
export function usePresence(profile: PersonId | null | undefined): PersonId[] | null {
  const [online, setOnline] = useState<PersonId[] | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase || !profile) return;
    const channel = supabase.channel("dispatch200-presence", { config: { presence: { key: profile } } });
    channel
      .on("presence", { event: "sync" }, () => {
        const keys = Object.keys(channel.presenceState()).filter(isPersonId);
        setOnline(PERSON_IDS.filter((id) => keys.includes(id)));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ profile, since: new Date().toISOString() });
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setOnline(null);
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile]);

  return online;
}
