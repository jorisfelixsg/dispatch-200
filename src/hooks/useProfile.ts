"use client";

import { useCallback, useSyncExternalStore } from "react";
import { isPersonId, type PersonId } from "@/lib/engine/people";

const STORAGE_KEY = "dispatch200.profile";
const CHANGE_EVENT = "dispatch200:profile-change";

function readProfile(): PersonId | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isPersonId(value) ? value : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * Profile chosen on the home screen, persisted in localStorage (US-01).
 * `profile` is `undefined` until the browser value is known (server render / hydration).
 */
export function useProfile() {
  const profile = useSyncExternalStore<PersonId | null | undefined>(
    subscribe,
    readProfile,
    () => undefined,
  );

  const setProfile = useCallback((id: PersonId | null) => {
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable (private mode…): the choice lasts for this page only.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { profile, setProfile };
}
