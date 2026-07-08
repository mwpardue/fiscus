create or replace function public.guard_occurrence()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_item_kind public.financial_item_kind;
  v_item_currency char(3);
  v_workflow text := current_setting('app.billing_workflow', true);
begin
  select item.kind, item.currency_code
    into v_item_kind, v_item_currency
  from public.financial_items as item
  where item.id = new.financial_item_id
    and item.user_id = new.user_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Occurrence must reference a financial item owned by the same user';
  end if;

  if new.currency_code <> v_item_currency then
    raise exception using
      errcode = '23514',
      message = 'Occurrence currency must match its financial item';
  end if;

  if (
    v_item_kind = 'bill'
    and new.lifecycle_status not in ('upcoming', 'paid', 'skipped')
  ) or (
    v_item_kind = 'income'
    and new.lifecycle_status not in ('upcoming', 'received', 'skipped')
  ) then
    raise exception using
      errcode = '23514',
      message = 'Occurrence lifecycle is invalid for its financial item kind';
  end if;

  if v_workflow = 'restore' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.lifecycle_status <> 'upcoming'
      or new.completed_at is not null
      or new.actual_amount_minor is not null
      or new.archived_at is not null
    then
      raise exception using
        errcode = '42501',
        message = 'New occurrences must be upcoming and unarchived';
    end if;
    return new;
  end if;

  if new.user_id <> old.user_id then
    raise exception using
      errcode = '42501',
      message = 'Occurrence ownership cannot be changed';
  end if;

  if v_workflow = 'complete' then
    if old.lifecycle_status <> 'upcoming'
      or new.lifecycle_status not in ('paid', 'received')
      or (
        to_jsonb(new) - array[
          'lifecycle_status',
          'completed_at',
          'actual_amount_minor',
          'updated_at'
        ]::text[]
      ) <> (
        to_jsonb(old) - array[
          'lifecycle_status',
          'completed_at',
          'actual_amount_minor',
          'updated_at'
        ]::text[]
      )
    then
      raise exception using
        errcode = '42501',
        message = 'Invalid occurrence completion update';
    end if;
    return new;
  end if;

  if v_workflow = 'skip' then
    if old.lifecycle_status <> 'upcoming'
      or new.lifecycle_status <> 'skipped'
      or (
        to_jsonb(new) - array['lifecycle_status', 'updated_at']::text[]
      ) <> (
        to_jsonb(old) - array['lifecycle_status', 'updated_at']::text[]
      )
    then
      raise exception using
        errcode = '42501',
        message = 'Invalid occurrence skip update';
    end if;
    return new;
  end if;

  if v_workflow = 'reopen' then
    if old.lifecycle_status not in ('paid', 'received', 'skipped')
      or new.lifecycle_status <> 'upcoming'
      or (
        to_jsonb(new) - array[
          'lifecycle_status',
          'completed_at',
          'actual_amount_minor',
          'updated_at'
        ]::text[]
      ) <> (
        to_jsonb(old) - array[
          'lifecycle_status',
          'completed_at',
          'actual_amount_minor',
          'updated_at'
        ]::text[]
      )
    then
      raise exception using
        errcode = '42501',
        message = 'Invalid occurrence reopen update';
    end if;
    return new;
  end if;

  if v_workflow = 'archive' then
    if new.lifecycle_status <> old.lifecycle_status
      or (
        to_jsonb(new) - array['archived_at', 'updated_at']::text[]
      ) <> (
        to_jsonb(old) - array['archived_at', 'updated_at']::text[]
      )
    then
      raise exception using
        errcode = '42501',
        message = 'Invalid occurrence archive update';
    end if;
    return new;
  end if;

  if old.lifecycle_status <> 'upcoming' or old.archived_at is not null then
    raise exception using
      errcode = '42501',
      message = 'Completed, skipped, and archived occurrences are locked';
  end if;

  if new.lifecycle_status <> 'upcoming'
    or new.completed_at is not null
    or new.actual_amount_minor is not null
    or new.archived_at is distinct from old.archived_at
  then
    raise exception using
      errcode = '42501',
      message = 'Use a guarded occurrence workflow for lifecycle changes';
  end if;

  return new;
end;
$$;

create or replace function public.guard_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_occurrence public.occurrences%rowtype;
  v_item_kind public.financial_item_kind;
  v_workflow text := current_setting('app.billing_workflow', true);
begin
  select occurrence.*
    into v_occurrence
  from public.occurrences as occurrence
  where occurrence.id = new.occurrence_id
    and occurrence.user_id = new.user_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Payment must reference an occurrence owned by the same user';
  end if;

  if new.currency_code <> v_occurrence.currency_code then
    raise exception using
      errcode = '23514',
      message = 'Payment currency must match its occurrence';
  end if;

  if v_workflow = 'restore' then
    return new;
  end if;

  select item.kind
    into v_item_kind
  from public.financial_items as item
  where item.id = v_occurrence.financial_item_id
    and item.user_id = v_occurrence.user_id;

  if (
    new.kind = 'payment'
    and (
      v_item_kind <> 'bill'
      or v_occurrence.lifecycle_status <> 'paid'
    )
  ) or (
    new.kind = 'receipt'
    and (
      v_item_kind <> 'income'
      or v_occurrence.lifecycle_status <> 'received'
    )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Payment kind does not match the completed occurrence';
  end if;

  if new.status = 'active'
    and (
      new.amount_minor <> v_occurrence.actual_amount_minor
      or new.completed_on <> v_occurrence.completed_at
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Active payment values must match the occurrence';
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id
      or new.occurrence_id <> old.occurrence_id
      or v_workflow <> 'reopen'
      or old.status <> 'active'
      or new.status <> 'voided'
      or (
        to_jsonb(new) - array[
          'status',
          'voided_at',
          'void_reason',
          'updated_at'
        ]::text[]
      ) <> (
        to_jsonb(old) - array[
          'status',
          'voided_at',
          'void_reason',
          'updated_at'
        ]::text[]
      )
    then
      raise exception using
        errcode = '42501',
        message = 'Payments can only be voided by the reopen workflow';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.restore_user_backup(p_backup jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_backup->>'schema' <> 'fiscus.user-backup.v1' then
    raise exception using errcode = '22023', message = 'Unsupported backup file';
  end if;

  select *
    into v_profile
  from jsonb_populate_record(null::public.profiles, coalesce(p_backup #> '{data,profile}', '{}'::jsonb));

  perform set_config('app.billing_workflow', 'restore', true);

  update public.recurrence_rules
  set converted_from_rule_id = null
  where user_id = v_user_id;

  delete from public.payments where user_id = v_user_id;
  delete from public.audit_events where user_id = v_user_id;
  delete from public.occurrences where user_id = v_user_id;
  delete from public.recurrence_rules where user_id = v_user_id;
  delete from public.financial_items where user_id = v_user_id;
  delete from public.categories where user_id = v_user_id;
  delete from public.counterparties where user_id = v_user_id;

  update public.profiles
  set default_currency_code = coalesce(v_profile.default_currency_code, default_currency_code),
      timezone = coalesce(v_profile.timezone, timezone),
      week_starts_on = coalesce(v_profile.week_starts_on, week_starts_on),
      theme_token = coalesce(v_profile.theme_token, theme_token),
      balance_anchor_amount_minor = v_profile.balance_anchor_amount_minor,
      balance_anchor_recorded_at = v_profile.balance_anchor_recorded_at
  where user_id = v_user_id;

  insert into public.counterparties (
    id,
    user_id,
    name,
    kind,
    notes,
    icon_storage_path,
    icon_updated_at,
    brandfetch_brand_id,
    brandfetch_domain,
    brandfetch_name,
    brandfetch_icon_url,
    brandfetch_updated_at,
    created_at,
    updated_at
  )
  select
    id,
    v_user_id,
    name,
    kind,
    notes,
    icon_storage_path,
    icon_updated_at,
    brandfetch_brand_id,
    brandfetch_domain,
    brandfetch_name,
    brandfetch_icon_url,
    brandfetch_updated_at,
    created_at,
    updated_at
  from jsonb_populate_recordset(
    null::public.counterparties,
    coalesce(p_backup #> '{data,counterparties}', '[]'::jsonb)
  );

  insert into public.categories (
    id,
    user_id,
    name,
    kind,
    color_token,
    created_at,
    updated_at
  )
  select id, v_user_id, name, kind, color_token, created_at, updated_at
  from jsonb_populate_recordset(
    null::public.categories,
    coalesce(p_backup #> '{data,categories}', '[]'::jsonb)
  );

  insert into public.financial_items (
    id,
    user_id,
    kind,
    name,
    description,
    counterparty_id,
    category_id,
    color_token,
    theme_token,
    icon_storage_path,
    icon_updated_at,
    brandfetch_brand_id,
    brandfetch_domain,
    brandfetch_name,
    brandfetch_icon_url,
    brandfetch_updated_at,
    default_amount_status,
    default_expected_amount_minor,
    currency_code,
    status,
    archived_at,
    hide_archived_history,
    created_at,
    updated_at
  )
  select
    id,
    v_user_id,
    kind,
    name,
    description,
    counterparty_id,
    category_id,
    color_token,
    theme_token,
    icon_storage_path,
    icon_updated_at,
    brandfetch_brand_id,
    brandfetch_domain,
    brandfetch_name,
    brandfetch_icon_url,
    brandfetch_updated_at,
    default_amount_status,
    default_expected_amount_minor,
    currency_code,
    status,
    archived_at,
    hide_archived_history,
    created_at,
    updated_at
  from jsonb_populate_recordset(
    null::public.financial_items,
    coalesce(p_backup #> '{data,financial_items}', '[]'::jsonb)
  );

  insert into public.recurrence_rules (
    id,
    user_id,
    financial_item_id,
    mode,
    interval_unit,
    interval_count,
    anchor_date,
    anchor_day,
    schedule_basis,
    anchor_weekday,
    ordinal_week,
    short_month_behavior,
    ends_on,
    occurrence_count,
    converted_from_rule_id,
    status,
    created_at,
    updated_at
  )
  select
    id,
    v_user_id,
    financial_item_id,
    mode,
    interval_unit,
    interval_count,
    anchor_date,
    anchor_day,
    schedule_basis,
    anchor_weekday,
    ordinal_week,
    short_month_behavior,
    ends_on,
    occurrence_count,
    null,
    status,
    created_at,
    updated_at
  from jsonb_populate_recordset(
    null::public.recurrence_rules,
    coalesce(p_backup #> '{data,recurrence_rules}', '[]'::jsonb)
  );

  update public.recurrence_rules as rule
  set converted_from_rule_id = restored.converted_from_rule_id
  from jsonb_populate_recordset(
    null::public.recurrence_rules,
    coalesce(p_backup #> '{data,recurrence_rules}', '[]'::jsonb)
  ) as restored
  where rule.user_id = v_user_id
    and rule.id = restored.id
    and restored.converted_from_rule_id is not null;

  insert into public.occurrences (
    id,
    user_id,
    financial_item_id,
    recurrence_rule_id,
    sequence_number,
    source,
    due_date,
    amount_status,
    expected_amount_minor,
    currency_code,
    lifecycle_status,
    completed_at,
    actual_amount_minor,
    archived_at,
    notes,
    created_at,
    updated_at
  )
  select
    id,
    v_user_id,
    financial_item_id,
    recurrence_rule_id,
    sequence_number,
    source,
    due_date,
    amount_status,
    expected_amount_minor,
    currency_code,
    lifecycle_status,
    completed_at,
    actual_amount_minor,
    archived_at,
    notes,
    created_at,
    updated_at
  from jsonb_populate_recordset(
    null::public.occurrences,
    coalesce(p_backup #> '{data,occurrences}', '[]'::jsonb)
  );

  insert into public.payments (
    id,
    user_id,
    occurrence_id,
    kind,
    amount_minor,
    currency_code,
    completed_on,
    status,
    voided_at,
    void_reason,
    created_at,
    updated_at
  )
  select
    id,
    v_user_id,
    occurrence_id,
    kind,
    amount_minor,
    currency_code,
    completed_on,
    status,
    voided_at,
    void_reason,
    created_at,
    updated_at
  from jsonb_populate_recordset(
    null::public.payments,
    coalesce(p_backup #> '{data,payments}', '[]'::jsonb)
  );

  insert into public.audit_events (
    id,
    user_id,
    event_type,
    entity_type,
    entity_id,
    reason,
    before_values,
    after_values,
    created_at
  )
  select
    id,
    v_user_id,
    event_type,
    entity_type,
    entity_id,
    reason,
    before_values,
    after_values,
    created_at
  from jsonb_populate_recordset(
    null::public.audit_events,
    coalesce(p_backup #> '{data,audit_events}', '[]'::jsonb)
  );

  insert into public.audit_events (
    user_id,
    event_type,
    entity_type,
    entity_id,
    reason
  ) values (
    v_user_id,
    'profile_updated',
    'profile',
    v_user_id,
    'User data restored from backup'
  );

  perform set_config('app.billing_workflow', '', true);
end;
$$;

revoke execute on function public.restore_user_backup(jsonb) from public, anon, authenticated;
grant execute on function public.restore_user_backup(jsonb) to authenticated;
