-- Dispatch 200 offres — step 6: daily snapshot of the capacity controls (R9: "Un instantané
-- est stocké à chaque changement de jour"). Idempotent: safe to run again.

create table if not exists public.control_snapshot (
  day_index  integer primary key check (day_index between 1 and 22),
  at_sim     integer not null,
  level      text not null check (level in ('green', 'orange', 'red')),
  controls   jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.control_snapshot enable row level security;
drop policy if exists "read_all" on public.control_snapshot;
create policy "read_all" on public.control_snapshot for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.control_snapshot from anon, authenticated;
grant select on public.control_snapshot to anon, authenticated;
grant all on public.control_snapshot to service_role;
