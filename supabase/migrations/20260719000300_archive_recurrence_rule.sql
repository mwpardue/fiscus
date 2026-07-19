create function public.archive_recurrence_rule(
  p_rule_id uuid,
  p_reason text default null
)
returns public.recurrence_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_before public.recurrence_rules%rowtype;
  v_after public.recurrence_rules%rowtype;
  v_archived_occurrence_count integer := 0;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'Recurrence rule archived');
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select *
    into v_before
  from public.recurrence_rules
  where id = p_rule_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Recurrence rule not found';
  end if;
  if v_before.status = 'archived' then
    raise exception using errcode = '22023', message = 'Recurrence rule is already archived';
  end if;

  perform set_config('app.billing_workflow', 'archive', true);

  update public.occurrences
  set archived_at = now()
  where recurrence_rule_id = p_rule_id
    and user_id = v_user_id
    and lifecycle_status = 'upcoming'
    and archived_at is null;

  get diagnostics v_archived_occurrence_count = row_count;

  update public.recurrence_rules
  set status = 'archived'
  where id = p_rule_id
    and user_id = v_user_id
  returning * into v_after;

  insert into public.audit_events (
    user_id,
    event_type,
    entity_type,
    entity_id,
    reason,
    before_values,
    after_values
  ) values (
    v_user_id,
    'schedule_edited',
    'financial_item',
    v_before.financial_item_id,
    v_reason,
    to_jsonb(v_before),
    to_jsonb(v_after) || jsonb_build_object(
      'archived_upcoming_occurrence_count',
      v_archived_occurrence_count
    )
  );

  perform set_config('app.billing_workflow', '', true);

  return v_after;
exception
  when others then
    perform set_config('app.billing_workflow', '', true);
    raise;
end;
$$;

revoke execute on function public.archive_recurrence_rule(uuid, text)
from public, anon, authenticated;

grant execute on function public.archive_recurrence_rule(uuid, text)
to authenticated;
