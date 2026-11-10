"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useSimClock } from "@/hooks/useSimClock";
import { DURATIONS, OFFER_COUNT, BUSINESS_DAYS } from "@/lib/engine/config";
import { DEFAULT_PEOPLE, type PersonDefaults } from "@/lib/engine/people";
import { formatSim } from "@/lib/engine/time";
import { homePathFor } from "@/lib/navigation";
import { HealthNotice } from "./HealthNotice";
import { PersonAvatar, personColor } from "./PersonAvatar";

function describe(person: PersonDefaults): string {
  if (person.role === "orchestrator") return "Tour de contrôle, suivi des offres, organisation, journal et simulation";
  return `Contributeur · tâche majeure ${person.majorStep}`;
}

/** E0 — Home: pick one of the 4 profiles (no password). */
export function HomeScreen() {
  const { profile, setProfile } = useProfile();
  const { nowSim } = useSimClock();
  const router = useRouter();

  // A remembered profile goes straight to its home screen (US-01).
  useEffect(() => {
    if (profile) router.replace(homePathFor(profile));
  }, [profile, router]);

  const choose = (person: PersonDefaults) => {
    setProfile(person.id);
    router.push(homePathFor(person.id));
  };

  if (profile) {
    return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <>
      <HealthNotice />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-8 px-4 py-10">
        <header className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Démo</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Dispatch {OFFER_COUNT} offres</h1>
          <p className="max-w-2xl text-muted-foreground">
            {OFFER_COUNT} offres marchands à publier en {BUSINESS_DAYS} jours ouvrés. L&apos;outil répartit les
            tâches au fil de l&apos;eau : chacun voit ce qui est le plus utile maintenant.
          </p>
          <div className="inline-flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/50 bg-card px-3 py-1.5 font-mono text-sm tabular-nums shadow-sm">
            <Clock className="size-4 text-muted-foreground" aria-hidden />
            <span className="font-sans text-muted-foreground">Horloge simulée</span>
            <span>{formatSim(nowSim)}</span>
          </div>
        </header>

        <section aria-labelledby="choose-profile" className="space-y-3">
          <h2 id="choose-profile" className="text-lg font-semibold">
            Qui es-tu ?
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {DEFAULT_PEOPLE.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => choose(person)}
                  className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-[var(--accent)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ ["--accent" as string]: personColor(person.id) }}
                >
                  <PersonAvatar id={person.id} name={person.name} className="size-12 text-lg" />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block font-semibold">{person.name}</span>
                    <span className="block text-sm text-muted-foreground">{describe(person)}</span>
                    {person.skills.length > 0 && (
                      <span className="flex flex-wrap gap-1 pt-0.5">
                        {person.skills.map((step) => (
                          <span
                            key={step}
                            className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
                            title={`${step} · ${DURATIONS[step]} min`}
                          >
                            {step}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    className="size-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
