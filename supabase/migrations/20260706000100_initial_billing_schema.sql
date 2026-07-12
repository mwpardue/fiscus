-- Billing App v1 schema.
-- User-owned data is isolated with RLS; financial history changes use guarded RPCs.

create extension if not exists pgcrypto with schema extensions;

create type public.financial_item_kind as enum ('bill', 'income');
create type public.amount_status as enum ('fixed', 'estimated', 'unknown');
create type public.financial_item_status as enum ('active', 'archived');
create type public.schedule_mode as enum ('ongoing', 'finite', 'manual');
create type public.interval_unit as enum ('day', 'week', 'month', 'year');
create type public.short_month_behavior as enum ('last_day', 'next_month', 'skip');
create type public.recurrence_rule_status as enum ('active', 'superseded', 'archived');
create type public.occurrence_source as enum ('generated', 'manual');
create type public.occurrence_lifecycle_status as enum (
  'upcoming',
  'paid',
  'received',
  'skipped'
);
create type public.payment_kind as enum ('payment', 'receipt');
create type public.payment_status as enum ('active', 'voided');
create type public.counterparty_kind as enum (
  'biller',
  'payer',
  'person',
  'merchant',
  'other'
);
create type public.category_kind as enum ('bill', 'income', 'both');
create type public.audit_event_type as enum (
  'occurrence_completed',
  'occurrence_reopened',
  'occurrence_skipped',
  'completed_occurrence_corrected',
  'payment_voided',
  'schedule_edited',
  'occurrence_archived',
  'financial_item_archived'
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  default_currency_code char(3) not null default 'USD',
  timezone text not null default 'UTC',
  week_starts_on smallint not null default 0,
  theme_token text not null default 'alteraest-light',
  balance_anchor_amount_minor bigint,
  balance_anchor_recorded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_currency_code_valid check (
    default_currency_code = upper(default_currency_code)
    and default_currency_code ~ '^[A-Z]{3}$'
  ),
  constraint profiles_timezone_not_blank check (btrim(timezone) <> ''),
  constraint profiles_balance_anchor_valid check (
    (
      balance_anchor_amount_minor is null
      and balance_anchor_recorded_at is null
    )
    or (
      balance_anchor_amount_minor is not null
      and balance_anchor_recorded_at is not null
    )
  ),
  constraint profiles_week_starts_on_valid check (week_starts_on between 0 and 6),
  constraint profiles_theme_token_valid check (
    theme_token in (
      'alteraest-light',
      'alteraest-dark'
    )
  )
);

create table public.counterparties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind public.counterparty_kind not null default 'other',
  website_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint counterparties_name_not_blank check (btrim(name) <> ''),
  constraint counterparties_website_url_valid check (
    website_url is null or website_url ~ '^https?://[^[:space:]]+$'
  ),
  constraint counterparties_id_user_id_unique unique (id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind public.category_kind not null default 'both',
  color_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_not_blank check (btrim(name) <> ''),
  constraint categories_color_token_not_blank check (
    color_token is null or btrim(color_token) <> ''
  ),
  constraint categories_id_user_id_unique unique (id, user_id)
);

create table public.financial_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.financial_item_kind not null,
  name text not null,
  description text,
  counterparty_id uuid,
  category_id uuid,
  color_token text,
  theme_token text,
  default_amount_status public.amount_status not null,
  default_expected_amount_minor bigint,
  currency_code char(3) not null,
  status public.financial_item_status not null default 'active',
  archived_at timestamptz,
  hide_archived_history boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_items_name_not_blank check (btrim(name) <> ''),
  constraint financial_items_color_token_not_blank check (
    color_token is null or btrim(color_token) <> ''
  ),
  constraint financial_items_theme_token_not_blank check (
    theme_token is null or btrim(theme_token) <> ''
  ),
  constraint financial_items_amount_valid check (
    (
      default_amount_status = 'unknown'
      and default_expected_amount_minor is null
    )
    or (
      default_amount_status in ('fixed', 'estimated')
      and default_expected_amount_minor is not null
      and default_expected_amount_minor >= 0
    )
  ),
  constraint financial_items_currency_code_valid check (
    currency_code = upper(currency_code)
    and currency_code ~ '^[A-Z]{3}$'
  ),
  constraint financial_items_archive_state_valid check (
    (status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  ),
  constraint financial_items_counterparty_owner_fk foreign key (counterparty_id, user_id)
    references public.counterparties (id, user_id),
  constraint financial_items_category_owner_fk foreign key (category_id, user_id)
    references public.categories (id, user_id),
  constraint financial_items_id_user_id_unique unique (id, user_id)
);

create table public.recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  financial_item_id uuid not null,
  mode public.schedule_mode not null,
  interval_unit public.interval_unit,
  interval_count integer,
  anchor_date date,
  anchor_day smallint,
  schedule_basis text not null default 'date',
  anchor_weekday smallint,
  ordinal_week smallint,
  short_month_behavior public.short_month_behavior,
  ends_on date,
  occurrence_count integer,
  converted_from_rule_id uuid,
  status public.recurrence_rule_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurrence_rules_mode_valid check (
    (
      mode = 'manual'
      and interval_unit is null
      and interval_count is null
      and anchor_date is null
      and anchor_day is null
      and short_month_behavior is null
      and ends_on is null
      and occurrence_count is null
    )
    or (
      mode = 'ongoing'
      and interval_unit is not null
      and interval_count > 0
      and anchor_date is not null
      and ends_on is null
      and occurrence_count is null
    )
    or (
      mode = 'finite'
      and interval_unit is not null
      and interval_count > 0
      and anchor_date is not null
      and ((ends_on is null) <> (occurrence_count is null))
      and (occurrence_count is null or occurrence_count > 0)
      and (ends_on is null or ends_on >= anchor_date)
    )
  ),
  constraint recurrence_rules_anchor_day_valid check (
    anchor_day is null
    or (
      interval_unit in ('month', 'year')
      and anchor_day between 1 and 31
    )
  ),
  constraint recurrence_rules_schedule_basis_valid check (
    schedule_basis in ('date', 'weekday', 'month_weekday')
  ),
  constraint recurrence_rules_anchor_weekday_valid check (
    anchor_weekday is null or anchor_weekday between 0 and 6
  ),
  constraint recurrence_rules_ordinal_week_valid check (
    ordinal_week is null or ordinal_week in (-1, 1, 2, 3, 4)
  ),
  constraint recurrence_rules_short_month_valid check (
    (
      interval_unit in ('month', 'year')
      and short_month_behavior is not null
    )
    or (
      (interval_unit not in ('month', 'year') or interval_unit is null)
      and short_month_behavior is null
    )
  ),
  constraint recurrence_rules_item_owner_fk foreign key (financial_item_id, user_id)
    references public.financial_items (id, user_id),
  constraint recurrence_rules_converted_from_owner_fk
    foreign key (converted_from_rule_id, user_id)
    references public.recurrence_rules (id, user_id),
  constraint recurrence_rules_id_user_id_unique unique (id, user_id),
  constraint recurrence_rules_id_item_user_unique
    unique (id, financial_item_id, user_id)
);

create table public.occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  financial_item_id uuid not null,
  recurrence_rule_id uuid,
  sequence_number integer,
  source public.occurrence_source not null,
  due_date date not null,
  amount_status public.amount_status not null,
  expected_amount_minor bigint,
  currency_code char(3) not null,
  lifecycle_status public.occurrence_lifecycle_status not null default 'upcoming',
  completed_at date,
  actual_amount_minor bigint,
  archived_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint occurrences_sequence_number_valid check (
    sequence_number is null or sequence_number > 0
  ),
  constraint occurrences_expected_amount_valid check (
    (
      amount_status = 'unknown'
      and expected_amount_minor is null
    )
    or (
      amount_status in ('fixed', 'estimated')
      and expected_amount_minor is not null
      and expected_amount_minor >= 0
    )
  ),
  constraint occurrences_currency_code_valid check (
    currency_code = upper(currency_code)
    and currency_code ~ '^[A-Z]{3}$'
  ),
  constraint occurrences_completion_state_valid check (
    (
      lifecycle_status in ('paid', 'received')
      and completed_at is not null
      and actual_amount_minor is not null
      and actual_amount_minor >= 0
    )
    or (
      lifecycle_status in ('upcoming', 'skipped')
      and completed_at is null
      and actual_amount_minor is null
    )
  ),
  constraint occurrences_item_owner_fk foreign key (financial_item_id, user_id)
    references public.financial_items (id, user_id),
  constraint occurrences_rule_item_owner_fk
    foreign key (recurrence_rule_id, financial_item_id, user_id)
    references public.recurrence_rules (id, financial_item_id, user_id),
  constraint occurrences_id_user_id_unique unique (id, user_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  occurrence_id uuid not null,
  kind public.payment_kind not null,
  amount_minor bigint not null,
  currency_code char(3) not null,
  completed_on date not null,
  status public.payment_status not null default 'active',
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_valid check (amount_minor >= 0),
  constraint payments_currency_code_valid check (
    currency_code = upper(currency_code)
    and currency_code ~ '^[A-Z]{3}$'
  ),
  constraint payments_void_state_valid check (
    (
      status = 'active'
      and voided_at is null
      and void_reason is null
    )
    or (
      status = 'voided'
      and voided_at is not null
      and void_reason is not null
      and btrim(void_reason) <> ''
    )
  ),
  constraint payments_occurrence_owner_fk foreign key (occurrence_id, user_id)
    references public.occurrences (id, user_id),
  constraint payments_id_user_id_unique unique (id, user_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type public.audit_event_type not null,
  entity_type text not null,
  entity_id uuid not null,
  reason text not null,
  before_values jsonb,
  after_values jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_entity_type_not_blank check (btrim(entity_type) <> ''),
  constraint audit_events_reason_not_blank check (btrim(reason) <> '')
);

create unique index counterparties_user_name_unique
  on public.counterparties (user_id, lower(btrim(name)));
create unique index categories_user_name_unique
  on public.categories (user_id, lower(btrim(name)));
create index financial_items_user_status_kind_idx
  on public.financial_items (user_id, status, kind);
create index recurrence_rules_user_item_status_idx
  on public.recurrence_rules (user_id, financial_item_id, status);
create index occurrences_user_due_date_idx
  on public.occurrences (user_id, due_date);
create index occurrences_user_lifecycle_due_date_idx
  on public.occurrences (user_id, lifecycle_status, due_date);
create index occurrences_user_item_due_date_idx
  on public.occurrences (user_id, financial_item_id, due_date);
create index occurrences_user_archived_due_date_idx
  on public.occurrences (user_id, archived_at, due_date);
create index payments_user_occurrence_idx
  on public.payments (user_id, occurrence_id);
create unique index payments_one_active_per_occurrence_idx
  on public.payments (occurrence_id)
  where status = 'active';
create index audit_events_user_created_at_idx
  on public.audit_events (user_id, created_at desc);
create index audit_events_entity_created_at_idx
  on public.audit_events (entity_type, entity_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
create trigger counterparties_set_updated_at
before update on public.counterparties
for each row execute function public.set_updated_at();
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();
create trigger financial_items_set_updated_at
before update on public.financial_items
for each row execute function public.set_updated_at();
create trigger recurrence_rules_set_updated_at
before update on public.recurrence_rules
for each row execute function public.set_updated_at();
create trigger occurrences_set_updated_at
before update on public.occurrences
for each row execute function public.set_updated_at();
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create function public.guard_occurrence()
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

create trigger occurrences_guard
before insert or update on public.occurrences
for each row execute function public.guard_occurrence();

create function public.guard_payment()
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

  select item.kind
    into v_item_kind
  from public.financial_items as item
  where item.id = v_occurrence.financial_item_id
    and item.user_id = v_occurrence.user_id;

  if new.currency_code <> v_occurrence.currency_code then
    raise exception using
      errcode = '23514',
      message = 'Payment currency must match its occurrence';
  end if;

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

create trigger payments_guard
before insert or update on public.payments
for each row execute function public.guard_payment();

alter table public.profiles enable row level security;
alter table public.counterparties enable row level security;
alter table public.categories enable row level security;
alter table public.financial_items enable row level security;
alter table public.recurrence_rules enable row level security;
alter table public.occurrences enable row level security;
alter table public.payments enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy counterparties_select_own on public.counterparties
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy counterparties_insert_own on public.counterparties
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy counterparties_update_own on public.counterparties
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy categories_select_own on public.categories
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy categories_insert_own on public.categories
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy categories_update_own on public.categories
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy financial_items_select_own on public.financial_items
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy financial_items_insert_own on public.financial_items
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy financial_items_update_own on public.financial_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy recurrence_rules_select_own on public.recurrence_rules
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy recurrence_rules_insert_own on public.recurrence_rules
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy occurrences_select_own on public.occurrences
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy occurrences_insert_own on public.occurrences
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy occurrences_update_own on public.occurrences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy payments_select_own on public.payments
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy audit_events_select_own on public.audit_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.counterparties from anon, authenticated;
revoke all on table public.categories from anon, authenticated;
revoke all on table public.financial_items from anon, authenticated;
revoke all on table public.recurrence_rules from anon, authenticated;
revoke all on table public.occurrences from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.counterparties to authenticated;
grant select, insert, update on table public.categories to authenticated;
grant select, insert on table public.financial_items to authenticated;
grant update (
  name,
  description,
  counterparty_id,
  category_id,
  default_amount_status,
  default_expected_amount_minor,
  currency_code,
  hide_archived_history,
  color_token,
  theme_token
) on table public.financial_items to authenticated;
grant select, insert on table public.recurrence_rules to authenticated;
grant select, insert on table public.occurrences to authenticated;
grant update (
  financial_item_id,
  recurrence_rule_id,
  sequence_number,
  source,
  due_date,
  amount_status,
  expected_amount_minor,
  currency_code,
  notes
) on table public.occurrences to authenticated;
grant select on table public.payments to authenticated;
grant select on table public.audit_events to authenticated;

create function public.complete_occurrence(
  p_occurrence_id uuid,
  p_amount_minor bigint,
  p_completed_on date,
  p_reason text default null
)
returns public.occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_before public.occurrences%rowtype;
  v_after public.occurrences%rowtype;
  v_item_kind public.financial_item_kind;
  v_payment_kind public.payment_kind;
  v_new_status public.occurrence_lifecycle_status;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'Occurrence completed');
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_amount_minor is null or p_amount_minor < 0 or p_completed_on is null then
    raise exception using
      errcode = '22023',
      message = 'A nonnegative amount and completion date are required';
  end if;

  select occurrence.*
    into v_before
  from public.occurrences as occurrence
  where occurrence.id = p_occurrence_id
    and occurrence.user_id = v_user_id
  for update of occurrence;

  if not found then
    raise exception using errcode = 'P0002', message = 'Occurrence not found';
  end if;
  if v_before.lifecycle_status <> 'upcoming' or v_before.archived_at is not null then
    raise exception using
      errcode = '22023',
      message = 'Only an unarchived upcoming occurrence can be completed';
  end if;

  select item.kind
    into v_item_kind
  from public.financial_items as item
  where item.id = v_before.financial_item_id
    and item.user_id = v_before.user_id;

  if v_item_kind = 'bill' then
    v_payment_kind := 'payment';
    v_new_status := 'paid';
  else
    v_payment_kind := 'receipt';
    v_new_status := 'received';
  end if;

  perform set_config('app.billing_workflow', 'complete', true);

  update public.occurrences
  set lifecycle_status = v_new_status,
      completed_at = p_completed_on,
      actual_amount_minor = p_amount_minor
  where id = p_occurrence_id
  returning * into v_after;

  insert into public.payments (
    user_id,
    occurrence_id,
    kind,
    amount_minor,
    currency_code,
    completed_on
  ) values (
    v_user_id,
    p_occurrence_id,
    v_payment_kind,
    p_amount_minor,
    v_before.currency_code,
    p_completed_on
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
    'occurrence_completed',
    'occurrence',
    p_occurrence_id,
    v_reason,
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  perform set_config('app.billing_workflow', '', true);

  return v_after;
end;
$$;

create function public.skip_occurrence(
  p_occurrence_id uuid,
  p_reason text default null
)
returns public.occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_before public.occurrences%rowtype;
  v_after public.occurrences%rowtype;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'Occurrence skipped');
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select *
    into v_before
  from public.occurrences
  where id = p_occurrence_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Occurrence not found';
  end if;
  if v_before.lifecycle_status <> 'upcoming' or v_before.archived_at is not null then
    raise exception using
      errcode = '22023',
      message = 'Only an unarchived upcoming occurrence can be skipped';
  end if;

  perform set_config('app.billing_workflow', 'skip', true);

  update public.occurrences
  set lifecycle_status = 'skipped'
  where id = p_occurrence_id
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
    'occurrence_skipped',
    'occurrence',
    p_occurrence_id,
    v_reason,
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  perform set_config('app.billing_workflow', '', true);

  return v_after;
end;
$$;

create function public.reopen_occurrence(
  p_occurrence_id uuid,
  p_reason text default null
)
returns public.occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_before public.occurrences%rowtype;
  v_after public.occurrences%rowtype;
  v_payment_before public.payments%rowtype;
  v_payment_after public.payments%rowtype;
  v_reason text := coalesce(
    nullif(btrim(p_reason), ''),
    'Occurrence reopened by user'
  );
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select *
    into v_before
  from public.occurrences
  where id = p_occurrence_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Occurrence not found';
  end if;
  if v_before.lifecycle_status not in ('paid', 'received', 'skipped') then
    raise exception using
      errcode = '22023',
      message = 'Only a completed or skipped occurrence can be reopened';
  end if;

  perform set_config('app.billing_workflow', 'reopen', true);

  if v_before.lifecycle_status in ('paid', 'received') then
    select *
      into v_payment_before
    from public.payments
    where occurrence_id = p_occurrence_id
      and user_id = v_user_id
      and status = 'active'
    for update;

    if not found then
      raise exception using
        errcode = '23514',
        message = 'Completed occurrence has no active payment';
    end if;

    update public.payments
    set status = 'voided',
        voided_at = now(),
        void_reason = v_reason
    where id = v_payment_before.id
    returning * into v_payment_after;

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
      'payment_voided',
      'payment',
      v_payment_before.id,
      v_reason,
      to_jsonb(v_payment_before),
      to_jsonb(v_payment_after)
    );
  end if;

  update public.occurrences
  set lifecycle_status = 'upcoming',
      completed_at = null,
      actual_amount_minor = null
  where id = p_occurrence_id
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
    'occurrence_reopened',
    'occurrence',
    p_occurrence_id,
    v_reason,
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  perform set_config('app.billing_workflow', '', true);

  return v_after;
end;
$$;

create function public.archive_occurrence(
  p_occurrence_id uuid,
  p_reason text default null
)
returns public.occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_before public.occurrences%rowtype;
  v_after public.occurrences%rowtype;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'Occurrence archived');
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select *
    into v_before
  from public.occurrences
  where id = p_occurrence_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Occurrence not found';
  end if;
  if v_before.archived_at is not null then
    raise exception using errcode = '22023', message = 'Occurrence is already archived';
  end if;

  perform set_config('app.billing_workflow', 'archive', true);

  update public.occurrences
  set archived_at = now()
  where id = p_occurrence_id
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
    'occurrence_archived',
    'occurrence',
    p_occurrence_id,
    v_reason,
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  perform set_config('app.billing_workflow', '', true);

  return v_after;
end;
$$;

create function public.archive_financial_item(
  p_financial_item_id uuid,
  p_hide_archived_history boolean default false,
  p_reason text default null
)
returns public.financial_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_before public.financial_items%rowtype;
  v_after public.financial_items%rowtype;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'Financial item archived');
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select *
    into v_before
  from public.financial_items
  where id = p_financial_item_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Financial item not found';
  end if;
  if v_before.status = 'archived' then
    raise exception using errcode = '22023', message = 'Financial item is already archived';
  end if;

  update public.recurrence_rules
  set status = 'archived'
  where financial_item_id = p_financial_item_id
    and user_id = v_user_id
    and status = 'active';

  update public.financial_items
  set status = 'archived',
      archived_at = now(),
      hide_archived_history = p_hide_archived_history
  where id = p_financial_item_id
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
    'financial_item_archived',
    'financial_item',
    p_financial_item_id,
    v_reason,
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  return v_after;
end;
$$;

create function public.replace_recurrence_rule(
  p_rule_id uuid,
  p_mode public.schedule_mode,
  p_interval_unit public.interval_unit,
  p_interval_count integer,
  p_anchor_date date,
  p_anchor_day smallint,
  p_short_month_behavior public.short_month_behavior,
  p_ends_on date,
  p_occurrence_count integer,
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
  if v_before.status <> 'active' then
    raise exception using
      errcode = '22023',
      message = 'Only an active recurrence rule can be replaced';
  end if;

  update public.recurrence_rules
  set status = 'superseded'
  where id = p_rule_id;

  insert into public.recurrence_rules (
    user_id,
    financial_item_id,
    mode,
    interval_unit,
    interval_count,
    anchor_date,
    anchor_day,
    short_month_behavior,
    ends_on,
    occurrence_count,
    converted_from_rule_id
  ) values (
    v_user_id,
    v_before.financial_item_id,
    p_mode,
    p_interval_unit,
    p_interval_count,
    p_anchor_date,
    p_anchor_day,
    p_short_month_behavior,
    p_ends_on,
    p_occurrence_count,
    case when p_mode = 'manual' then v_before.id else null end
  )
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
    to_jsonb(v_after)
  );

  return v_after;
end;
$$;

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
  p_ordinal_week smallint default null
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
    ordinal_week
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
    p_ordinal_week
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

create function public.create_manual_financial_item(
  p_kind public.financial_item_kind,
  p_name text,
  p_default_amount_status public.amount_status,
  p_default_expected_amount_minor bigint,
  p_currency_code char(3),
  p_due_dates date[]
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

  if array_length(p_due_dates, 1) is null then
    raise exception using
      errcode = '23514',
      message = 'At least one manual due date is required';
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
    schedule_basis
  )
  values (
    v_user_id,
    v_financial_item_id,
    'manual',
    'date'
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
    'manual',
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
  p_ordinal_week smallint default null
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
    ordinal_week
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
    p_ordinal_week
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

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.guard_occurrence() from public, anon, authenticated;
revoke execute on function public.guard_payment() from public, anon, authenticated;

revoke execute on function public.complete_occurrence(uuid, bigint, date, text)
  from public, anon;
revoke execute on function public.skip_occurrence(uuid, text)
  from public, anon;
revoke execute on function public.reopen_occurrence(uuid, text)
  from public, anon;
revoke execute on function public.archive_occurrence(uuid, text)
  from public, anon;
revoke execute on function public.archive_financial_item(uuid, boolean, text)
  from public, anon;
revoke execute on function public.replace_recurrence_rule(
  uuid,
  public.schedule_mode,
  public.interval_unit,
  integer,
  date,
  smallint,
  public.short_month_behavior,
  date,
  integer,
  text
) from public, anon;
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
  smallint
) from public;
revoke execute on function public.create_manual_financial_item(
  public.financial_item_kind,
  text,
  public.amount_status,
  bigint,
  char(3),
  date[]
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
  smallint
) from public;

grant execute on function public.complete_occurrence(uuid, bigint, date, text)
  to authenticated;
grant execute on function public.skip_occurrence(uuid, text)
  to authenticated;
grant execute on function public.reopen_occurrence(uuid, text)
  to authenticated;
grant execute on function public.archive_occurrence(uuid, text)
  to authenticated;
grant execute on function public.archive_financial_item(uuid, boolean, text)
  to authenticated;
grant execute on function public.replace_recurrence_rule(
  uuid,
  public.schedule_mode,
  public.interval_unit,
  integer,
  date,
  smallint,
  public.short_month_behavior,
  date,
  integer,
  text
) to authenticated;
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
  smallint
) to authenticated;
grant execute on function public.create_manual_financial_item(
  public.financial_item_kind,
  text,
  public.amount_status,
  bigint,
  char(3),
  date[]
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
  smallint
) to authenticated;
