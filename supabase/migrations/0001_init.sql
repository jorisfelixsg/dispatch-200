-- Dispatch 200 offres — initial schema (spec section 5).
-- Idempotent: safe to run again in the Supabase SQL editor.
-- Writes go through server routes with the service key; browsers read with the anon key (RLS read-only).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.person (
  id               text primary key,
  name             text not null,
  role             text not null check (role in ('contributor', 'orchestrator')),
  skills           text[] not null default '{}',
  major_step       text check (major_step in ('S1', 'S2', 'S3', 'S4', 'S5')),
  priority_order   text[] not null default '{}',
  forced_mode      boolean not null default false,
  forced_sequence  text[] not null default '{}',
  daily_budget_min integer not null default 60,
  sort_order       integer not null default 0
);

create table if not exists public.offer (
  id            integer primary key,
  rank          integer not null,
  merchant_name text not null,
  slug          text not null unique,
  importance    text not null check (importance in ('A', 'B', 'C')),
  category      text not null,
  description   text not null,
  url           text not null,
  image_url     text not null,
  logo_url      text not null,
  constraint offer_rank_unique unique (rank) deferrable initially deferred
);

create table if not exists public.step_execution (
  id           bigint generated always as identity primary key,
  offer_id     integer not null references public.offer (id) on delete cascade,
  step         text not null check (step in ('S1', 'S2', 'S3', 'S4', 'S5')),
  done_by      text not null references public.person (id),
  done_at_sim  integer not null,
  done_at_real timestamptz not null default now(),
  in_priority  boolean not null default true,
  source       text not null default 'manual' check (source in ('manual', 'auto')),
  constraint step_execution_offer_step_unique unique (offer_id, step)
);

create table if not exists public.day_adjustment (
  person_id       text not null references public.person (id) on delete cascade,
  day_index       integer not null check (day_index between 1 and 22),
  extra_min       integer not null default 0,
  absent_declared boolean not null default false,
  absent_detected boolean not null default false,
  primary key (person_id, day_index)
);

create table if not exists public.session (
  person_id           text not null references public.person (id) on delete cascade,
  day_index           integer not null check (day_index between 1 and 22),
  cursor_sim          integer not null,
  consumed_min        integer not null default 0,
  last_heartbeat_real timestamptz not null default now(),
  primary key (person_id, day_index)
);

-- One reservation per task (R7): a task can be shown in only one list at a time.
create table if not exists public.reservation (
  offer_id        integer not null references public.offer (id) on delete cascade,
  step            text not null check (step in ('S1', 'S2', 'S3', 'S4', 'S5')),
  person_id       text not null references public.person (id) on delete cascade,
  expires_at_real timestamptz not null,
  primary key (offer_id, step)
);

create table if not exists public.sim_state (
  id              integer primary key default 1 check (id = 1),
  now_sim         integer not null,
  seed            integer not null default 42,
  auto_running    boolean not null default false,
  reference_curve jsonb,
  renfort_s1      jsonb not null default '{"active": false}'::jsonb,
  -- Incremented on every reset so clients can tell a reset happened.
  epoch           integer not null default 0,
  updated_at      timestamptz not null default now()
);

create table if not exists public.applied_action (
  id             bigint generated always as identity primary key,
  type           text not null check (type in ('FORCE_ORDER', 'RENFORT_S1', 'TRAIN_BACKUP', 'EXTRA_HOUR', 'RERANK')),
  params         jsonb not null default '{}'::jsonb,
  applied_at_sim integer not null,
  cancelled      boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists public.event (
  id        bigint generated always as identity primary key,
  type      text not null check (type in (
              'STEP_DONE', 'OUT_OF_PRIORITY', 'ABSENCE_DECLARED', 'ABSENCE_DETECTED',
              'ACTION_APPLIED', 'ACTION_CANCELLED', 'CLOCK_CHANGED', 'AUTO_RUN', 'RESET')),
  person_id text references public.person (id) on delete set null,
  payload   jsonb not null default '{}'::jsonb,
  at_sim    integer not null,
  at_real   timestamptz not null default now()
);

create index if not exists event_at_real_idx on public.event (at_real desc);
create index if not exists step_execution_offer_idx on public.step_execution (offer_id);

-- ---------------------------------------------------------------------------
-- Read-only access for browsers (anon key), full access for the service key
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['person', 'offer', 'step_execution', 'day_adjustment', 'session',
                           'reservation', 'sim_state', 'applied_action', 'event']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "read_all" on public.%I', t);
    execute format('create policy "read_all" on public.%I for select to anon, authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime: tables whose changes are pushed to browsers (used from step 4)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['step_execution', 'sim_state', 'person', 'applied_action',
                           'day_adjustment', 'offer', 'event']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- R16 — Reset in one transaction. Offers and people come from the
-- deterministic TypeScript seed and are passed as JSON.
-- ---------------------------------------------------------------------------

create or replace function public.reset_demo(
  p_offers  jsonb,
  p_people  jsonb,
  p_now_sim integer,
  p_seed    integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table public.event, public.applied_action, public.reservation, public.session,
                 public.day_adjustment, public.step_execution, public.offer
    restart identity;

  insert into public.offer (id, rank, merchant_name, slug, importance, category, description, url, image_url, logo_url)
  select x.id, x.rank, x.merchant_name, x.slug, x.importance, x.category, x.description, x.url, x.image_url, x.logo_url
  from jsonb_to_recordset(p_offers) as x(
    id integer, rank integer, merchant_name text, slug text, importance text,
    category text, description text, url text, image_url text, logo_url text);

  delete from public.person
  where id not in (select x.id from jsonb_to_recordset(p_people) as x(id text));

  insert into public.person (id, name, role, skills, major_step, priority_order, forced_mode,
                             forced_sequence, daily_budget_min, sort_order)
  select x.id, x.name, x.role, x.skills, x.major_step, x.priority_order, x.forced_mode,
         x.forced_sequence, x.daily_budget_min, x.sort_order
  from jsonb_to_recordset(p_people) as x(
    id text, name text, role text, skills text[], major_step text, priority_order text[],
    forced_mode boolean, forced_sequence text[], daily_budget_min integer, sort_order integer)
  on conflict (id) do update set
    name             = excluded.name,
    role             = excluded.role,
    skills           = excluded.skills,
    major_step       = excluded.major_step,
    priority_order   = excluded.priority_order,
    forced_mode      = excluded.forced_mode,
    forced_sequence  = excluded.forced_sequence,
    daily_budget_min = excluded.daily_budget_min,
    sort_order       = excluded.sort_order;

  insert into public.sim_state (id, now_sim, seed, auto_running, reference_curve, renfort_s1, epoch, updated_at)
  values (1, p_now_sim, p_seed, false, null, '{"active": false}'::jsonb, 1, now())
  on conflict (id) do update set
    now_sim         = excluded.now_sim,
    seed            = excluded.seed,
    auto_running    = false,
    reference_curve = null,
    renfort_s1      = excluded.renfort_s1,
    epoch           = public.sim_state.epoch + 1,
    updated_at      = now();

  insert into public.event (type, person_id, payload, at_sim)
  values ('RESET', 'orchestrator', '{}'::jsonb, p_now_sim);
end;
$$;

revoke all on function public.reset_demo(jsonb, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.reset_demo(jsonb, jsonb, integer, integer) to service_role;
