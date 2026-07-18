create function public.update_generated_recurrence_rule(
  p_rule_id uuid,
  p_mode public.schedule_mode,
  p_interval_unit public.interval_unit,
  p_interval_count integer,
  p_anchor_date date,
  p_anchor_day smallint,
  p_short_month_behavior public.short_month_behavior,
  p_occurrence_count integer,
  p_due_dates date[],
  p_schedule_basis text default 'date',
  p_anchor_weekday smallint default null,
  p_ordinal_week smallint default null,
  p_business_day_adjustment text default 'none',
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
  v_item public.financial_items%rowtype;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'Schedule edited');
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
      message = 'Only an active generated recurrence rule can be edited';
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

  if p_mode not in ('ongoing', 'finite') then
    raise exception using errcode = '23514', message = 'Only generated schedules are supported';
  end if;

  if p_interval_count is null or p_interval_count < 1 then
    raise exception using errcode = '23514', message = 'Interval count must be positive';
  end if;

  if p_schedule_basis not in ('date', 'weekday', 'month_weekday') then
    raise exception using errcode = '23514', message = 'Schedule basis is invalid';
  end if;

  if p_business_day_adjustment not in (
    'none',
    'previous_business_day',
    'next_business_day'
  ) then
    raise exception using errcode = '23514', message = 'Business day adjustment is invalid';
  end if;

  if array_length(p_due_dates, 1) is null then
    raise exception using errcode = '23514', message = 'At least one due date is required';
  end if;

  perform set_config('app.billing_workflow', 'schedule_edit', true);

  delete from public.occurrences
  where recurrence_rule_id = p_rule_id
    and financial_item_id = v_before.financial_item_id
    and user_id = v_user_id
    and source = 'generated'
    and lifecycle_status = 'upcoming'
    and archived_at is null
    and due_date <> all(p_due_dates);

  update public.recurrence_rules
  set mode = p_mode,
      interval_unit = p_interval_unit,
      interval_count = p_interval_count,
      anchor_date = p_anchor_date,
      anchor_day = p_anchor_day,
      short_month_behavior = p_short_month_behavior,
      ends_on = null,
      occurrence_count = case when p_mode = 'finite' then p_occurrence_count else null end,
      schedule_basis = p_schedule_basis,
      anchor_weekday = p_anchor_weekday,
      ordinal_week = p_ordinal_week,
      business_day_adjustment = p_business_day_adjustment
  where id = p_rule_id
  returning * into v_after;

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
    p_rule_id,
    due_dates.ordinality::integer,
    'generated',
    due_dates.due_date,
    v_item.default_amount_status,
    v_item.default_expected_amount_minor,
    v_item.currency_code
  from unnest(p_due_dates) with ordinality as due_dates(due_date, ordinality)
  where not exists (
    select 1
    from public.occurrences as occurrence
    where occurrence.recurrence_rule_id = p_rule_id
      and occurrence.user_id = v_user_id
      and occurrence.source = 'generated'
      and occurrence.due_date = due_dates.due_date
      and occurrence.archived_at is null
  );

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
    to_jsonb(v_after)
  );

  return v_after;
end;
$$;

revoke execute on function public.update_generated_recurrence_rule(
  uuid,
  public.schedule_mode,
  public.interval_unit,
  integer,
  date,
  smallint,
  public.short_month_behavior,
  integer,
  date[],
  text,
  smallint,
  smallint,
  text,
  text
) from public, anon;

grant execute on function public.update_generated_recurrence_rule(
  uuid,
  public.schedule_mode,
  public.interval_unit,
  integer,
  date,
  smallint,
  public.short_month_behavior,
  integer,
  date[],
  text,
  smallint,
  smallint,
  text,
  text
) to authenticated;

create function public.add_generated_occurrences_to_rule(
  p_rule_id uuid,
  p_due_dates date[],
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_rule public.recurrence_rules%rowtype;
  v_item public.financial_items%rowtype;
  v_inserted_count integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select *
    into v_rule
  from public.recurrence_rules
  where id = p_rule_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Recurrence rule not found';
  end if;

  if v_rule.status <> 'active' or v_rule.mode <> 'ongoing' then
    raise exception using
      errcode = '22023',
      message = 'Only active ongoing recurrence rules can be extended';
  end if;

  select *
    into v_item
  from public.financial_items
  where id = v_rule.financial_item_id
    and user_id = v_user_id
    and status = 'active';

  if not found then
    raise exception using errcode = 'P0002', message = 'Financial item not found';
  end if;

  if array_length(p_due_dates, 1) is null then
    return 0;
  end if;

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
    v_rule.financial_item_id,
    v_rule.id,
    coalesce(existing.max_sequence_number, 0) + due_dates.ordinality::integer,
    'generated',
    due_dates.due_date,
    v_item.default_amount_status,
    v_item.default_expected_amount_minor,
    v_item.currency_code
  from unnest(p_due_dates) with ordinality as due_dates(due_date, ordinality)
  cross join lateral (
    select max(occurrence.sequence_number) as max_sequence_number
    from public.occurrences as occurrence
    where occurrence.recurrence_rule_id = v_rule.id
      and occurrence.user_id = v_user_id
  ) as existing
  where not exists (
    select 1
    from public.occurrences as occurrence
    where occurrence.recurrence_rule_id = v_rule.id
      and occurrence.user_id = v_user_id
      and occurrence.source = 'generated'
      and occurrence.due_date = due_dates.due_date
      and occurrence.archived_at is null
  );

  get diagnostics v_inserted_count = row_count;

  return v_inserted_count;
end;
$$;

revoke execute on function public.add_generated_occurrences_to_rule(
  uuid,
  date[],
  text
) from public, anon;

grant execute on function public.add_generated_occurrences_to_rule(
  uuid,
  date[],
  text
) to authenticated;
