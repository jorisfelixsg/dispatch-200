-- Dispatch 200 offres — step 5: auto mode lock and persistence (R14), reset with the
-- reference trajectory (R15, R16). Idempotent: safe to run again in the Supabase SQL editor.
-- The simulation itself runs in the TypeScript engine on an in-memory copy; these functions
-- only take the lock and write its result in one transaction.

-- ---------------------------------------------------------------------------
-- Lock: auto_running = true. Manual "Fait" clicks and clock moves are refused meanwhile.
-- A lock older than 5 minutes (crashed run) can be taken over.
-- ---------------------------------------------------------------------------

create or replace function public.start_auto()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.sim_state%rowtype;
begin
  select * into v from public.sim_state where id = 1 for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_seeded');
  end if;
  if v.auto_running and v.updated_at > now() - interval '5 minutes' then
    return jsonb_build_object('ok', false, 'code', 'auto_running');
  end if;
  update public.sim_state set auto_running = true, updated_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'now_sim', v.now_sim, 'seed', v.seed, 'epoch', v.epoch);
end;
$$;

-- Releases the lock after a failed run (only if no reset happened meanwhile).
create or replace function public.release_auto(p_epoch integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.sim_state set auto_running = false, updated_at = now() where id = 1 and epoch = p_epoch;
$$;

-- ---------------------------------------------------------------------------
-- Writes the result of an auto run and releases the lock, in one transaction.
-- Discarded if a reset happened during the run (epoch changed).
-- ---------------------------------------------------------------------------

create or replace function public.finish_auto(
  p_epoch       integer,
  p_seed        integer,
  p_now_sim     integer,
  p_executions  jsonb,
  p_sessions    jsonb,
  p_absences    jsonb,
  p_events      jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.sim_state%rowtype;
begin
  select * into v from public.sim_state where id = 1 for update;
  if not found or v.epoch <> p_epoch or not v.auto_running then
    return jsonb_build_object('ok', false, 'code', 'reset');
  end if;

  insert into public.step_execution (offer_id, step, done_by, done_at_sim, done_at_real, in_priority, source)
  select x.offer_id, x.step, x.done_by, x.done_at_sim, coalesce(x.done_at_real, now()), true, 'auto'
  from jsonb_to_recordset(p_executions) as x(offer_id integer, step text, done_by text, done_at_sim integer, done_at_real timestamptz)
  on conflict (offer_id, step) do nothing;

  insert into public.session (person_id, day_index, cursor_sim, consumed_min, last_heartbeat_real)
  select x.person_id, x.day_index, x.cursor_sim, x.consumed_min, now()
  from jsonb_to_recordset(p_sessions) as x(person_id text, day_index integer, cursor_sim integer, consumed_min integer)
  on conflict (person_id, day_index) do update set
    cursor_sim   = excluded.cursor_sim,
    consumed_min = excluded.consumed_min;

  insert into public.day_adjustment (person_id, day_index, absent_detected)
  select x.person_id, x.day_index, true
  from jsonb_to_recordset(p_absences) as x(person_id text, day_index integer)
  on conflict (person_id, day_index) do update set absent_detected = true;

  insert into public.event (type, person_id, payload, at_sim)
  select x.type, x.person_id, coalesce(x.payload, '{}'::jsonb), x.at_sim
  from jsonb_to_recordset(p_events) as x(type text, person_id text, payload jsonb, at_sim integer);

  -- Lists shown before the run are stale. (Supabase refuses a DELETE without WHERE.)
  delete from public.reservation where offer_id is not null;

  update public.sim_state set
    now_sim      = greatest(now_sim, p_now_sim),
    seed         = p_seed,
    auto_running = false,
    updated_at   = now()
  where id = 1;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- R16 — reset that also stores the reference trajectory (R15), still one transaction.
-- ---------------------------------------------------------------------------

create or replace function public.reset_demo(
  p_offers          jsonb,
  p_people          jsonb,
  p_now_sim         integer,
  p_seed            integer,
  p_reference_curve jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.reset_demo(p_offers, p_people, p_now_sim, p_seed);
  update public.sim_state set reference_curve = p_reference_curve where id = 1;
end;
$$;

revoke all on function public.start_auto() from public, anon, authenticated;
revoke all on function public.release_auto(integer) from public, anon, authenticated;
revoke all on function public.finish_auto(integer, integer, integer, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.reset_demo(jsonb, jsonb, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.start_auto() to service_role;
grant execute on function public.release_auto(integer) to service_role;
grant execute on function public.finish_auto(integer, integer, integer, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.reset_demo(jsonb, jsonb, integer, integer, jsonb) to service_role;
