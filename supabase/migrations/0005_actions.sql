-- Dispatch 200 offres — step 7: catch-up actions (R11), applied and cancelled in one transaction.
-- The effect is computed by the TypeScript engine; this function writes it together with the
-- applied_action row and the journal event. Idempotent: safe to run again.

create or replace function public.persist_action(
  p_action_id   bigint,   -- null: apply a new action; otherwise: cancel this action
  p_type        text,
  p_params      jsonb,
  p_at_sim      integer,
  p_people      jsonb,    -- [{id, skills, priority_order, forced_mode, forced_sequence}] to update
  p_renfort     jsonb,    -- new sim_state.renfort_s1, or null if unchanged
  p_adjustments jsonb,    -- [{person_id, day_index, extra_min}] to upsert
  p_ranks       jsonb     -- [{id, rank}] to update, or null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auto boolean;
  v_id   bigint;
begin
  select auto_running into v_auto from public.sim_state where id = 1 for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_seeded');
  end if;
  if v_auto then
    return jsonb_build_object('ok', false, 'code', 'auto_running');
  end if;

  if p_action_id is null then
    insert into public.applied_action (type, params, applied_at_sim)
    values (p_type, coalesce(p_params, '{}'::jsonb), p_at_sim)
    returning id into v_id;
  else
    update public.applied_action set cancelled = true
    where id = p_action_id and not cancelled
    returning id into v_id;
    if v_id is null then
      return jsonb_build_object('ok', false, 'code', 'already_cancelled');
    end if;
  end if;

  update public.person p set
    skills          = x.skills,
    priority_order  = x.priority_order,
    forced_mode     = x.forced_mode,
    forced_sequence = x.forced_sequence
  from jsonb_to_recordset(coalesce(p_people, '[]'::jsonb))
    as x(id text, skills text[], priority_order text[], forced_mode boolean, forced_sequence text[])
  where p.id = x.id;

  if p_renfort is not null then
    update public.sim_state set renfort_s1 = p_renfort, updated_at = now() where id = 1;
  end if;

  insert into public.day_adjustment (person_id, day_index, extra_min)
  select x.person_id, x.day_index, x.extra_min
  from jsonb_to_recordset(coalesce(p_adjustments, '[]'::jsonb)) as x(person_id text, day_index integer, extra_min integer)
  on conflict (person_id, day_index) do update set extra_min = excluded.extra_min;

  if p_ranks is not null then
    update public.offer o set rank = x.rank
    from jsonb_to_recordset(p_ranks) as x(id integer, rank integer)
    where o.id = x.id;
  end if;

  -- Lists shown before the change are stale.
  delete from public.reservation where offer_id is not null;

  insert into public.event (type, person_id, payload, at_sim)
  values (
    case when p_action_id is null then 'ACTION_APPLIED' else 'ACTION_CANCELLED' end,
    'orchestrator',
    jsonb_build_object('actionId', v_id, 'type', p_type, 'params', coalesce(p_params, '{}'::jsonb)),
    p_at_sim
  );

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.persist_action(bigint, text, jsonb, integer, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.persist_action(bigint, text, jsonb, integer, jsonb, jsonb, jsonb, jsonb) to service_role;
