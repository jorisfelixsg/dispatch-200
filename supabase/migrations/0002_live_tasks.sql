-- Dispatch 200 offres — step 4: "Fait" click, reservations and clock.
-- Idempotent: safe to run again in the Supabase SQL editor.
-- The priority rules stay in the TypeScript engine; these functions only make the writes atomic.

-- Business day (1-based) of a simulated minute, or null on a weekend.
create or replace function public.business_day_of(p_sim integer)
returns integer
language sql
immutable
as $$
  select case when (p_sim / 1440) % 7 >= 5 then null
              else ((p_sim / 1440) / 7) * 5 + (p_sim / 1440) % 7 + 1 end;
$$;

-- ---------------------------------------------------------------------------
-- "Fait" (R3, R4, R7): one transaction. The unique (offer_id, step) constraint
-- refuses a second validation ("Déjà faite par X").
-- ---------------------------------------------------------------------------

create or replace function public.complete_step(
  p_person   text,
  p_offer    integer,
  p_step     text,
  p_duration integer,
  p_source   text default 'manual'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now      integer;
  v_auto     boolean;
  v_day      integer;
  v_cursor   integer;
  v_done_at  integer;
  v_done_by  text;
begin
  select now_sim, auto_running into v_now, v_auto from public.sim_state where id = 1;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_seeded');
  end if;
  if v_auto and p_source = 'manual' then
    return jsonb_build_object('ok', false, 'code', 'auto_running');
  end if;
  v_day := public.business_day_of(v_now);
  if v_day is null then
    return jsonb_build_object('ok', false, 'code', 'not_business_day');
  end if;

  -- Serialize the clicks of one person so their session cursor stays consistent.
  perform pg_advisory_xact_lock(hashtext('dispatch200:session:' || p_person));

  -- R3: if there is no session for the day, or its cursor is behind now_sim, start from now_sim.
  select cursor_sim into v_cursor from public.session where person_id = p_person and day_index = v_day;
  v_done_at := greatest(coalesce(v_cursor, v_now), v_now) + p_duration;

  begin
    insert into public.step_execution (offer_id, step, done_by, done_at_sim, in_priority, source)
    values (p_offer, p_step, p_person, v_done_at, true, p_source);
  exception when unique_violation then
    select done_by into v_done_by from public.step_execution where offer_id = p_offer and step = p_step;
    return jsonb_build_object('ok', false, 'code', 'already_done', 'done_by', v_done_by);
  end;

  -- R4: the minutes count for the day of now_sim at click time.
  insert into public.session (person_id, day_index, cursor_sim, consumed_min, last_heartbeat_real)
  values (p_person, v_day, v_done_at, p_duration, now())
  on conflict (person_id, day_index) do update set
    cursor_sim          = excluded.cursor_sim,
    consumed_min        = public.session.consumed_min + excluded.consumed_min,
    last_heartbeat_real = now();

  delete from public.reservation where offer_id = p_offer and step = p_step;

  insert into public.event (type, person_id, payload, at_sim)
  values ('STEP_DONE', p_person, jsonb_build_object('offerId', p_offer, 'step', p_step, 'source', p_source), v_done_at);

  return jsonb_build_object('ok', true, 'done_at_sim', v_done_at, 'day_index', v_day);
end;
$$;

-- ---------------------------------------------------------------------------
-- R7: replace the reservations of a person. A task already reserved by another
-- active person is not taken; it is returned so the server can recompute.
-- ---------------------------------------------------------------------------

create or replace function public.replace_reservations(
  p_person text,
  p_tasks  jsonb,
  p_ttl_ms integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflicts jsonb;
begin
  delete from public.reservation where person_id = p_person or expires_at_real <= now();

  insert into public.reservation (offer_id, step, person_id, expires_at_real)
  select t.offer_id, t.step, p_person, now() + make_interval(secs => p_ttl_ms / 1000.0)
  from jsonb_to_recordset(p_tasks) as t(offer_id integer, step text)
  on conflict (offer_id, step) do nothing;

  select coalesce(jsonb_agg(jsonb_build_object('offer_id', t.offer_id, 'step', t.step)), '[]'::jsonb)
  into v_conflicts
  from jsonb_to_recordset(p_tasks) as t(offer_id integer, step text)
  where not exists (
    select 1 from public.reservation r
    where r.offer_id = t.offer_id and r.step = t.step and r.person_id = p_person
  );

  return v_conflicts;
end;
$$;

-- ---------------------------------------------------------------------------
-- R13: move the clock. The new value is computed by the TypeScript engine; the
-- update only succeeds if nobody moved the clock meanwhile, and never goes back.
-- ---------------------------------------------------------------------------

create or replace function public.set_clock(
  p_expected integer,
  p_new      integer,
  p_label    text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now  integer;
  v_auto boolean;
begin
  select now_sim, auto_running into v_now, v_auto from public.sim_state where id = 1 for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_seeded');
  end if;
  if v_auto then
    return jsonb_build_object('ok', false, 'code', 'auto_running');
  end if;
  if v_now <> p_expected then
    return jsonb_build_object('ok', false, 'code', 'conflict', 'now_sim', v_now);
  end if;
  if p_new < v_now then
    return jsonb_build_object('ok', false, 'code', 'backwards', 'now_sim', v_now);
  end if;
  if p_new = v_now then
    return jsonb_build_object('ok', true, 'now_sim', v_now, 'changed', false);
  end if;

  update public.sim_state set now_sim = p_new, updated_at = now() where id = 1;

  insert into public.event (type, person_id, payload, at_sim)
  values ('CLOCK_CHANGED', 'orchestrator', jsonb_build_object('from', v_now, 'to', p_new, 'label', p_label), p_new);

  return jsonb_build_object('ok', true, 'now_sim', p_new, 'changed', true);
end;
$$;

revoke all on function public.complete_step(text, integer, text, integer, text) from public, anon, authenticated;
revoke all on function public.replace_reservations(text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.set_clock(integer, integer, text) from public, anon, authenticated;
grant execute on function public.complete_step(text, integer, text, integer, text) to service_role;
grant execute on function public.replace_reservations(text, jsonb, integer) to service_role;
grant execute on function public.set_clock(integer, integer, text) to service_role;
