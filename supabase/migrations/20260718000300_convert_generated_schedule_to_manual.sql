create function public.convert_generated_recurrence_rule_to_manual(
  p_rule_id uuid,
  p_due_dates date[],
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_before public.recurrence_rules%rowtype;
  v_item public.financial_items%rowtype;
  v_manual_rule_id uuid;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'Schedule converted to manual');
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

  if v_before.status <> 'active' or v_before.mode not in ('ongoing', 'finite') then
    raise exception using
      errcode = '22023',
      message = 'Only an active generated recurrence rule can be converted';
  end if;

  if array_length(p_due_dates, 1) is null then
    raise exception using errcode = '23514', message = 'At least one manual due date is required';
  end if;

  select *
    into v_item
  from public.financial_items
  where id = v_before.financial_item_id
    and user_id = v_user_id
    and status = 'active'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Financial item not found';
  end if;

  perform set_config('app.billing_workflow', 'schedule_edit', true);

  update public.recurrence_rules
  set status = 'superseded'
  where financial_item_id = v_before.financial_item_id
    and user_id = v_user_id
    and status = 'active'
    and mode in ('ongoing', 'finite');

  delete from public.occurrences
  where financial_item_id = v_before.financial_item_id
    and user_id = v_user_id
    and source = 'generated'
    and lifecycle_status = 'upcoming'
    and archived_at is null;

  insert into public.recurrence_rules (
    user_id,
    financial_item_id,
    mode,
    schedule_basis,
    converted_from_rule_id
  )
  values (
    v_user_id,
    v_before.financial_item_id,
    'manual',
    'date',
    p_rule_id
  )
  returning id into v_manual_rule_id;

  insert into public.occurrences (
    user_id,
    financial_item_id,
    recurrence_rule_id,
    sequence_number,
    source,
    due_date,
    amount_status,
    expected_amount_minor,
    currency_code
  )
  select
    v_user_id,
    v_before.financial_item_id,
    v_manual_rule_id,
    due_dates.ordinality::integer,
    'manual',
    due_dates.due_date,
    v_item.default_amount_status,
    v_item.default_expected_amount_minor,
    v_item.currency_code
  from unnest(p_due_dates) with ordinality as due_dates(due_date, ordinality);

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
    jsonb_build_object(
      'manual_rule_id', v_manual_rule_id,
      'due_dates', p_due_dates
    )
  );

  return v_manual_rule_id;
end;
$$;

revoke execute on function public.convert_generated_recurrence_rule_to_manual(
  uuid,
  date[],
  text
) from public, anon, authenticated;

grant execute on function public.convert_generated_recurrence_rule_to_manual(
  uuid,
  date[],
  text
) to authenticated;

create function public.supersede_sibling_generated_recurrence_rules(
  p_keep_rule_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_keep_rule public.recurrence_rules%rowtype;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'Sibling schedules superseded');
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select *
    into v_keep_rule
  from public.recurrence_rules
  where id = p_keep_rule_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Recurrence rule not found';
  end if;

  perform set_config('app.billing_workflow', 'schedule_edit', true);

  delete from public.occurrences
  where financial_item_id = v_keep_rule.financial_item_id
    and user_id = v_user_id
    and recurrence_rule_id <> p_keep_rule_id
    and source = 'generated'
    and lifecycle_status = 'upcoming'
    and archived_at is null;

  update public.recurrence_rules
  set status = 'superseded'
  where financial_item_id = v_keep_rule.financial_item_id
    and user_id = v_user_id
    and id <> p_keep_rule_id
    and status = 'active'
    and mode in ('ongoing', 'finite');

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
    v_keep_rule.financial_item_id,
    v_reason,
    jsonb_build_object('kept_rule_id', p_keep_rule_id),
    jsonb_build_object('superseded_sibling_rules', true)
  );
end;
$$;

revoke execute on function public.supersede_sibling_generated_recurrence_rules(
  uuid,
  text
) from public, anon, authenticated;

grant execute on function public.supersede_sibling_generated_recurrence_rules(
  uuid,
  text
) to authenticated;
