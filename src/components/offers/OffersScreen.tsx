"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Search } from "lucide-react";
import { useOffersData } from "@/hooks/useOffersData";
import { useProfile } from "@/hooks/useProfile";
import { useSimState } from "@/hooks/useSimState";
import { STEPS, type Step } from "@/lib/engine/config";
import { getDefaultPerson, type PersonId } from "@/lib/engine/people";
import {
  indexExecutions,
  isStepReady,
  offerPhase,
  type OfferPhase,
  type StepMap,
} from "@/lib/engine/offerStatus";
import { formatSimShort, SIM_START } from "@/lib/engine/time";
import type { Offer, Person } from "@/lib/engine/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Filter = "all" | "published" | "waiting24h" | `pending:${Step}`;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Toutes les offres" },
  ...STEPS.map((s) => ({ value: `pending:${s}` as Filter, label: `Étape ${s} non faite` })),
  { value: "waiting24h", label: "Bloquées en attente des 24h" },
  { value: "published", label: "Publiées" },
];

const PHASE_LABEL: Record<OfferPhase, { label: string; variant: "green" | "orange" | "default" | "outline" }> = {
  published: { label: "Publiée", variant: "green" },
  waiting24h: { label: "Attente 24h", variant: "orange" },
  inProgress: { label: "En cours", variant: "default" },
  notStarted: { label: "À démarrer", variant: "outline" },
};

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

interface Row {
  offer: Offer;
  steps: StepMap;
  phase: OfferPhase;
}

/** E3 — Tracking of the 200 offers (read-only, everyone). */
export function OffersScreen() {
  const { state: sim, status: simStatus } = useSimState();
  const nowSim = sim?.now_sim ?? SIM_START;
  const data = useOffersData(sim?.epoch ?? null);
  const { profile } = useProfile();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const deferredQuery = useDeferredValue(query);

  const names = useMemo(() => {
    const map = new Map<PersonId, string>();
    if (data.status === "ready") data.data.people.forEach((p: Person) => map.set(p.id, p.name));
    return map;
  }, [data]);

  const rows = useMemo<Row[]>(() => {
    if (data.status !== "ready") return [];
    const index = indexExecutions(data.data.executions);
    return data.data.offers.map((offer) => {
      const steps = index.get(offer.id) ?? {};
      return { offer, steps, phase: offerPhase(steps, nowSim) };
    });
  }, [data, nowSim]);

  const visible = useMemo(() => {
    const q = normalize(deferredQuery.trim());
    return rows.filter((r) => {
      if (q && !normalize(r.offer.merchantName).includes(q)) return false;
      if (filter === "all") return true;
      if (filter === "published") return r.phase === "published";
      if (filter === "waiting24h") return r.phase === "waiting24h";
      return !r.steps[filter.slice("pending:".length) as Step];
    });
  }, [rows, deferredQuery, filter]);

  const publishedCount = rows.filter((r) => r.phase === "published").length;

  const isOrchestrator = profile ? getDefaultPerson(profile).role === "orchestrator" : false;

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Suivi des offres</h1>
        <p className="text-sm text-muted-foreground">
          {data.status === "ready" ? `${publishedCount} / ${rows.length} publiées` : "Chargement…"}
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Rechercher un marchand</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un marchand"
            className="h-11 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="sm:w-72">
          <span className="sr-only">Filtrer</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {data.status === "error" && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          Impossible de lire les offres : {data.message}
        </p>
      )}

      {data.status === "ready" && rows.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Aucune offre en base.{" "}
          {isOrchestrator ? (
            <>
              Clique sur « Réinitialiser la démo » dans l&apos;écran{" "}
              <Link href="/clock" className="font-medium text-foreground underline">
                Horloge
              </Link>{" "}
              pour créer les 200 offres.
            </>
          ) : (
            "L'orchestrateur doit réinitialiser la démo pour créer les 200 offres."
          )}
        </div>
      )}

      {data.status === "ready" && rows.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {visible.length} offre{visible.length > 1 ? "s" : ""} affichée{visible.length > 1 ? "s" : ""}
            {simStatus === "ok" ? "" : " · horloge indisponible"}
          </p>

          {/* Desktop / tablet: table */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Rang</th>
                  <th scope="col" className="px-3 py-2 font-medium">Marchand</th>
                  {STEPS.map((s) => (
                    <th key={s} scope="col" className="px-3 py-2 font-medium">{s}</th>
                  ))}
                  <th scope="col" className="px-3 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((r) => (
                  <tr key={r.offer.id} className="align-middle">
                    <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">{r.offer.rank}</td>
                    <td className="px-3 py-2">
                      <MerchantCell offer={r.offer} />
                    </td>
                    {STEPS.map((s) => (
                      <td key={s} className="px-3 py-2">
                        <StepCell steps={r.steps} step={s} nowSim={nowSim} names={names} />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <Badge variant={PHASE_LABEL[r.phase].variant}>{PHASE_LABEL[r.phase].label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <ul className="space-y-2 md:hidden">
            {visible.map((r) => (
              <li key={r.offer.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-8 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">#{r.offer.rank}</span>
                    <MerchantCell offer={r.offer} />
                  </div>
                  <Badge variant={PHASE_LABEL[r.phase].variant}>{PHASE_LABEL[r.phase].label}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-5 gap-1.5">
                  {STEPS.map((s) => (
                    <div key={s} className="rounded-md bg-muted/60 px-1.5 py-1 text-center">
                      <dt className="font-mono text-[11px] text-muted-foreground">{s}</dt>
                      <dd>
                        <StepCell steps={r.steps} step={s} nowSim={nowSim} names={names} compact />
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function MerchantCell({ offer }: { offer: Offer }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Image src={offer.logoUrl} alt="" width={32} height={32} unoptimized className="size-8 shrink-0 rounded-lg" />
      <div className="min-w-0">
        <p className="truncate font-medium" title={offer.description}>
          {offer.merchantName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {offer.category}
        </p>
      </div>
    </div>
  );
}

function StepCell({
  steps,
  step,
  nowSim,
  names,
  compact = false,
}: {
  steps: StepMap;
  step: Step;
  nowSim: number;
  names: Map<PersonId, string>;
  compact?: boolean;
}) {
  const execution = steps[step];
  if (execution) {
    const who = names.get(execution.doneBy) ?? execution.doneBy;
    const when = formatSimShort(execution.doneAtSim);
    return (
      <span className="inline-flex items-center gap-1 text-ok" title={`Fait par ${who}, fin ${when}`}>
        <Check className="size-3.5 shrink-0" aria-hidden />
        <span className="sr-only">Fait</span>
        {!compact && (
          <span className="text-xs text-foreground">
            {who} <span className="font-mono text-muted-foreground">{when}</span>
          </span>
        )}
      </span>
    );
  }
  const ready = isStepReady(steps, step, nowSim);
  return (
    <span
      className={cn("text-xs", ready ? "text-foreground" : "text-muted-foreground")}
      title={ready ? "Prête" : "Non prête (dépendances ou délai de 24h)"}
    >
      {ready ? (compact ? "prête" : "Prête") : "—"}
    </span>
  );
}
