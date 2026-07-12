alter table public.recurrence_rules
  add column business_day_adjustment text not null default 'none';

alter table public.recurrence_rules
  add constraint recurrence_rules_business_day_adjustment_valid check (
    business_day_adjustment in (
      'none',
      'previous_business_day',
      'next_business_day'
    )
  );

drop function public.create_generated_financial_item(
  public.financial_item_kind,
  text,
  public.amount_status,
  bigint,
  char(3),
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
  smallint
);

drop function public.add_generated_schedule_to_financial_item(
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
  smallint
);

create function public.create_generated_financial_item(
  p_kind public.financial_item_kind,
  p_name text,
  p_default_amount_status public.amount_status,
  p_default_expected_amount_minor bigint,
  p_currency_code char(3),
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
  p_business_day_adjustment text default 'none'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_financial_item_id uuid;
  v_recurrence_rule_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  if p_mode not in ('ongoing', 'finite') then
    raise exception using
      errcode = '23514',
      message = 'Only generated schedules can use this workflow';
  end if;

  if p_interval_count is null or p_interval_count < 1 then
    raise exception using
      errcode = '23514',
      message = 'Interval count must be positive';
  end if;

  if p_schedule_basis not in ('date', 'weekday', 'month_weekday') then
    raise exception using
      errcode = '23514',
      message = 'Schedule basis is invalid';
  end if;

  if p_business_day_adjustment not in (
    'none',
    'previous_business_day',
    'next_business_day'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Business day adjustment is invalid';
  end if;

  if array_length(p_due_dates, 1) is null then
    raise exception using
      errcode = '23514',
      message = 'At least one due date is required';
  end if;

  insert into public.financial_items (
    user_id,
    kind,
    name,
    default_amount_status,
    default_expected_amount_minor,
    currency_code
  )
  values (
    v_user_id,
    p_kind,
    p_name,
    p_default_amount_status,
    p_default_expected_amount_minor,
    p_currency_code
  )
  returning id into v_financial_item_id;

  insert into public.recurrence_rules (
    user_id,
    financial_item_id,
    mode,
    interval_unit,
    interval_count,
    anchor_date,
    anchor_day,
    short_month_behavior,
    occurrence_count,
    schedule_basis,
    anchor_weekday,
    ordinal_week,
    business_day_adjustment
  )
  values (
    v_user_id,
    v_financial_item_id,
    p_mode,
    p_interval_unit,
    p_interval_count,
    p_anchor_date,
    p_anchor_day,
    p_short_month_behavior,
    case when p_mode = 'finite' then p_occurrence_count else null end,
    p_schedule_basis,
    p_anchor_weekday,
    p_ordinal_week,
    p_business_day_adjustment
  )
  returning id into v_recurrence_rule_id;

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
    v_financial_item_id,
    v_recurrence_rule_id,
    due_dates.ordinality::integer,
    'generated',
    due_dates.due_date,
    p_default_amount_status,
    p_default_expected_amount_minor,
    p_currency_code
  from unnest(p_due_dates) with ordinality as due_dates(due_date, ordinality);

  return v_financial_item_id;
end;
$$;

create function public.add_generated_schedule_to_financial_item(
  p_financial_item_id uuid,
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
  p_business_day_adjustment text default 'none'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.financial_items%rowtype;
  v_recurrence_rule_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  select *
    into v_item
  from public.financial_items
  where id = p_financial_item_id
    and user_id = v_user_id
    and status = 'active';

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Financial item not found';
  end if;

  if p_mode not in ('ongoing', 'finite') then
    raise exception using
      errcode = '23514',
      message = 'Only generated schedules can use this workflow';
  end if;

  if p_interval_count is null or p_interval_count < 1 then
    raise exception using
      errcode = '23514',
      message = 'Interval count must be positive';
  end if;

  if p_schedule_basis not in ('date', 'weekday', 'month_weekday') then
    raise exception using
      errcode = '23514',
      message = 'Schedule basis is invalid';
  end if;

  if p_business_day_adjustment not in (
    'none',
    'previous_business_day',
    'next_business_day'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Business day adjustment is invalid';
  end if;

  if array_length(p_due_dates, 1) is null then
    raise exception using
      errcode = '23514',
      message = 'At least one due date is required';
  end if;

  insert into public.recurrence_rules (
    user_id,
    financial_item_id,
    mode,
    interval_unit,
    interval_count,
    anchor_date,
    anchor_day,
    short_month_behavior,
    occurrence_count,
    schedule_basis,
    anchor_weekday,
    ordinal_week,
    business_day_adjustment
  )
  values (
    v_user_id,
    p_financial_item_id,
    p_mode,
    p_interval_unit,
    p_interval_count,
    p_anchor_date,
    p_anchor_day,
    p_short_month_behavior,
    case when p_mode = 'finite' then p_occurrence_count else null end,
    p_schedule_basis,
    p_anchor_weekday,
    p_ordinal_week,
    p_business_day_adjustment
  )
  returning id into v_recurrence_rule_id;

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
    p_financial_item_id,
    v_recurrence_rule_id,
    due_dates.ordinality::integer,
    'generated',
    due_dates.due_date,
    v_item.default_amount_status,
    v_item.default_expected_amount_minor,
    v_item.currency_code
  from unnest(p_due_dates) with ordinality as due_dates(due_date, ordinality);

  return v_recurrence_rule_id;
end;
$$;

revoke execute on function public.create_generated_financial_item(
  public.financial_item_kind,
  text,
  public.amount_status,
  bigint,
  char(3),
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
  text
) from public;

revoke execute on function public.add_generated_schedule_to_financial_item(
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
  text
) from public;

grant execute on function public.create_generated_financial_item(
  public.financial_item_kind,
  text,
  public.amount_status,
  bigint,
  char(3),
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
  text
) to authenticated;

grant execute on function public.add_generated_schedule_to_financial_item(
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
  text
) to authenticated;
