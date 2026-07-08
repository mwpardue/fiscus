begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(48);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'billing-user-1@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'billing-user-2@example.test');

insert into public.profiles (user_id, default_currency_code, timezone)
values
  ('11111111-1111-4111-8111-111111111111', 'USD', 'America/New_York'),
  ('22222222-2222-4222-8222-222222222222', 'USD', 'America/New_York');

insert into public.financial_items (
  id,
  user_id,
  kind,
  name,
  default_amount_status,
  default_expected_amount_minor,
  currency_code
)
values
  (
    '11111111-1111-4111-8111-111111111101',
    '11111111-1111-4111-8111-111111111111',
    'bill',
    'User One Bill',
    'fixed',
    5000,
    'USD'
  ),
  (
    '22222222-2222-4222-8222-222222222202',
    '22222222-2222-4222-8222-222222222222',
    'income',
    'User Two Income',
    'fixed',
    100000,
    'USD'
  );

insert into public.recurrence_rules (
  id,
  user_id,
  financial_item_id,
  mode
)
values
  (
    '11111111-1111-4111-8111-111111111102',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111101',
    'manual'
  ),
  (
    '22222222-2222-4222-8222-222222222203',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222202',
    'manual'
  );

insert into public.occurrences (
  id,
  user_id,
  financial_item_id,
  recurrence_rule_id,
  source,
  due_date,
  amount_status,
  expected_amount_minor,
  currency_code
)
values
  (
    '11111111-1111-4111-8111-111111111103',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111101',
    '11111111-1111-4111-8111-111111111102',
    'manual',
    '2026-07-01',
    'fixed',
    5000,
    'USD'
  ),
  (
    '22222222-2222-4222-8222-222222222204',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222202',
    '22222222-2222-4222-8222-222222222203',
    'manual',
    '2026-07-02',
    'fixed',
    100000,
    'USD'
  );

select has_table('public', 'occurrences', 'occurrences table exists');
select has_table('public', 'payments', 'payments table exists');
select has_table('public', 'audit_events', 'audit events table exists');
select has_index(
  'public',
  'payments',
  'payments_one_active_per_occurrence_idx',
  'one active payment index exists'
);
select is_definer(
  'public',
  'complete_occurrence',
  array['uuid', 'bigint', 'date', 'text'],
  'completion function is security definer'
);
select is_definer(
  'public',
  'reopen_occurrence',
  array['uuid', 'text'],
  'reopen function is security definer'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select results_eq(
  $$select count(*) from public.financial_items$$,
  array[1::bigint],
  'user one sees only their financial item'
);
select results_eq(
  $$select count(*) from public.occurrences$$,
  array[1::bigint],
  'user one sees only their occurrence'
);
select is_empty(
  $$
    update public.occurrences
    set notes = 'cross-user update'
    where id = '22222222-2222-4222-8222-222222222204'
    returning id
  $$,
  'user one cannot update user two occurrence'
);
select throws_ok(
  $$
    insert into public.occurrences (
      user_id,
      financial_item_id,
      recurrence_rule_id,
      source,
      due_date,
      amount_status,
      expected_amount_minor,
      currency_code
    ) values (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222202',
      '22222222-2222-4222-8222-222222222203',
      'manual',
      '2026-08-01',
      'fixed',
      1000,
      'USD'
    )
  $$,
  '23503',
  'Occurrence must reference a financial item owned by the same user',
  'cross-user occurrence relationship is rejected'
);
select throws_ok(
  $$
    insert into public.audit_events (
      user_id,
      event_type,
      entity_type,
      entity_id,
      reason
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'occurrence_completed',
      'occurrence',
      '11111111-1111-4111-8111-111111111103',
      'forged audit event'
    )
  $$,
  '42501',
  'permission denied for table audit_events',
  'authenticated users cannot forge audit events'
);

select lives_ok(
  $$
    select public.create_generated_financial_item(
      'bill'::public.financial_item_kind,
      'User One Mortgage',
      'fixed'::public.amount_status,
      175000::bigint,
      'USD'::char(3),
      'ongoing'::public.schedule_mode,
      'month'::public.interval_unit,
      1::integer,
      '2026-07-31'::date,
      31::smallint,
      'last_day'::public.short_month_behavior,
      null::integer,
      array[
        '2026-07-31',
        '2026-08-31',
        '2026-09-30'
      ]::date[],
      'date',
      null::smallint,
      null::smallint
    )
  $$,
  'owner can atomically create a monthly generated financial item'
);
select results_eq(
  $$
    select rule.mode::text || ':' || rule.interval_unit::text || ':' || rule.anchor_day::text
    from public.recurrence_rules as rule
    join public.financial_items as item
      on item.id = rule.financial_item_id
    where item.name = 'User One Mortgage'
  $$,
  array['ongoing:month:31'::text],
  'monthly creation stores the recurrence rule'
);
select results_eq(
  $$
    select string_agg(occurrence.due_date::text, ',' order by occurrence.sequence_number)
    from public.occurrences as occurrence
    join public.financial_items as item
      on item.id = occurrence.financial_item_id
    where item.name = 'User One Mortgage'
  $$,
  array['2026-07-31,2026-08-31,2026-09-30'::text],
  'monthly creation stores generated occurrences in order'
);
select lives_ok(
  $$
    select public.create_generated_financial_item(
      'bill'::public.financial_item_kind,
      'User One Installment Plan',
      'estimated'::public.amount_status,
      2500::bigint,
      'USD'::char(3),
      'finite'::public.schedule_mode,
      'week'::public.interval_unit,
      2::integer,
      '2026-07-06'::date,
      null::smallint,
      null::public.short_month_behavior,
      4::integer,
      array[
        '2026-07-06',
        '2026-07-20',
        '2026-08-03',
        '2026-08-17'
      ]::date[],
      'date',
      null::smallint,
      null::smallint
    )
  $$,
  'owner can atomically create a finite generated financial item'
);
select results_eq(
  $$
    select rule.mode::text || ':' || rule.interval_unit::text || ':' || rule.interval_count::text || ':' || rule.occurrence_count::text
    from public.recurrence_rules as rule
    join public.financial_items as item
      on item.id = rule.financial_item_id
    where item.name = 'User One Installment Plan'
  $$,
  array['finite:week:2:4'::text],
  'finite creation stores recurrence count and cadence'
);
select results_eq(
  $$
    select string_agg(occurrence.due_date::text, ',' order by occurrence.sequence_number)
    from public.occurrences as occurrence
    join public.financial_items as item
      on item.id = occurrence.financial_item_id
    where item.name = 'User One Installment Plan'
  $$,
  array['2026-07-06,2026-07-20,2026-08-03,2026-08-17'::text],
  'finite creation stores generated occurrences in order'
);
select lives_ok(
  $$
    select public.add_generated_schedule_to_financial_item(
      (
        select id
        from public.financial_items
        where name = 'User One Installment Plan'
      ),
      'finite'::public.schedule_mode,
      'week'::public.interval_unit,
      2::integer,
      '2026-07-07'::date,
      null::smallint,
      null::public.short_month_behavior,
      2::integer,
      array[
        '2026-07-07',
        '2026-07-21'
      ]::date[],
      'weekday',
      2::smallint,
      null::smallint
    )
  $$,
  'owner can add a second active schedule to one financial item'
);
select results_eq(
  $$
    select count(*)
    from public.recurrence_rules as rule
    join public.financial_items as item
      on item.id = rule.financial_item_id
    where item.name = 'User One Installment Plan'
      and rule.status = 'active'
  $$,
  array[2::bigint],
  'one financial item can have multiple active recurrence rules'
);
select lives_ok(
  $$
    select public.create_generated_financial_item(
      'bill'::public.financial_item_kind,
      'User One Annual Renewal',
      'fixed'::public.amount_status,
      12000::bigint,
      'USD'::char(3),
      'finite'::public.schedule_mode,
      'year'::public.interval_unit,
      1::integer,
      '2028-02-29'::date,
      29::smallint,
      'last_day'::public.short_month_behavior,
      3::integer,
      array[
        '2028-02-29',
        '2029-02-28',
        '2030-02-28'
      ]::date[],
      'date',
      null::smallint,
      null::smallint
    )
  $$,
  'owner can create a yearly generated financial item'
);
select results_eq(
  $$
    select rule.mode::text || ':' || rule.interval_unit::text || ':' || rule.anchor_day::text || ':' || rule.short_month_behavior::text
    from public.recurrence_rules as rule
    join public.financial_items as item
      on item.id = rule.financial_item_id
    where item.name = 'User One Annual Renewal'
  $$,
  array['finite:year:29:last_day'::text],
  'yearly creation stores recurrence rule and short-year behavior'
);
select results_eq(
  $$
    select string_agg(occurrence.due_date::text, ',' order by occurrence.sequence_number)
    from public.occurrences as occurrence
    join public.financial_items as item
      on item.id = occurrence.financial_item_id
    where item.name = 'User One Annual Renewal'
  $$,
  array['2028-02-29,2029-02-28,2030-02-28'::text],
  'yearly creation stores generated occurrences in order'
);
select lives_ok(
  $$
    select public.create_generated_financial_item(
      'bill'::public.financial_item_kind,
      'User One Last Tuesday',
      'fixed'::public.amount_status,
      3000::bigint,
      'USD'::char(3),
      'finite'::public.schedule_mode,
      'month'::public.interval_unit,
      1::integer,
      '2026-07-01'::date,
      null::smallint,
      'last_day'::public.short_month_behavior,
      3::integer,
      array[
        '2026-07-28',
        '2026-08-25',
        '2026-09-29'
      ]::date[],
      'month_weekday',
      2::smallint,
      -1::smallint
    )
  $$,
  'owner can create a monthly ordinal weekday schedule'
);
select results_eq(
  $$
    select rule.schedule_basis || ':' || rule.anchor_weekday::text || ':' || rule.ordinal_week::text
    from public.recurrence_rules as rule
    join public.financial_items as item
      on item.id = rule.financial_item_id
    where item.name = 'User One Last Tuesday'
  $$,
  array['month_weekday:2:-1'::text],
  'ordinal weekday metadata is stored'
);
select results_eq(
  $$
    select string_agg(occurrence.due_date::text, ',' order by occurrence.sequence_number)
    from public.occurrences as occurrence
    join public.financial_items as item
      on item.id = occurrence.financial_item_id
    where item.name = 'User One Last Tuesday'
  $$,
  array['2026-07-28,2026-08-25,2026-09-29'::text],
  'monthly ordinal weekday creation stores generated dates'
);
select lives_ok(
  $$
    select public.create_manual_financial_item(
      'bill'::public.financial_item_kind,
      'User One Manual Plan',
      'unknown'::public.amount_status,
      null::bigint,
      'USD'::char(3),
      array[
        '2026-07-07',
        '2026-07-19',
        '2026-08-02'
      ]::date[]
    )
  $$,
  'owner can create a manual financial item'
);
select results_eq(
  $$
    select rule.mode::text || ':' || rule.schedule_basis
    from public.recurrence_rules as rule
    join public.financial_items as item
      on item.id = rule.financial_item_id
    where item.name = 'User One Manual Plan'
  $$,
  array['manual:date'::text],
  'manual creation stores a manual recurrence rule'
);
select results_eq(
  $$
    select string_agg(occurrence.source::text || ':' || occurrence.due_date::text, ',' order by occurrence.sequence_number)
    from public.occurrences as occurrence
    join public.financial_items as item
      on item.id = occurrence.financial_item_id
    where item.name = 'User One Manual Plan'
  $$,
  array['manual:2026-07-07,manual:2026-07-19,manual:2026-08-02'::text],
  'manual creation stores manual occurrences in order'
);

select lives_ok(
  $$
    select public.complete_occurrence(
      '11111111-1111-4111-8111-111111111103',
      4900,
      '2026-07-03',
      null
    )
  $$,
  'owner can complete their occurrence'
);
select results_eq(
  $$
    select lifecycle_status::text
    from public.occurrences
    where id = '11111111-1111-4111-8111-111111111103'
  $$,
  array['paid'::text],
  'bill occurrence becomes paid'
);
select results_eq(
  $$
    select count(*)
    from public.payments
    where occurrence_id = '11111111-1111-4111-8111-111111111103'
      and status = 'active'
  $$,
  array[1::bigint],
  'completion creates one active payment'
);
select throws_ok(
  $$
    update public.occurrences
    set due_date = '2026-07-10'
    where id = '11111111-1111-4111-8111-111111111103'
  $$,
  '42501',
  'Completed, skipped, and archived occurrences are locked',
  'paid occurrence cannot be edited directly'
);
select throws_ok(
  $$
    select public.complete_occurrence(
      '22222222-2222-4222-8222-222222222204',
      100000,
      '2026-07-03',
      null
    )
  $$,
  'P0002',
  'Occurrence not found',
  'user one cannot complete user two occurrence'
);
select lives_ok(
  $$
    select public.reopen_occurrence(
      '11111111-1111-4111-8111-111111111103',
      'Correct accidental completion'
    )
  $$,
  'owner can reopen a paid past occurrence'
);
select results_eq(
  $$
    select lifecycle_status::text
    from public.occurrences
    where id = '11111111-1111-4111-8111-111111111103'
  $$,
  array['upcoming'::text],
  'reopened occurrence becomes upcoming'
);
select results_eq(
  $$
    select count(*)
    from public.payments
    where occurrence_id = '11111111-1111-4111-8111-111111111103'
      and status = 'voided'
  $$,
  array[1::bigint],
  'reopen preserves the payment as voided'
);
select lives_ok(
  $$
    update public.occurrences
    set due_date = '2026-06-30',
        expected_amount_minor = 5100
    where id = '11111111-1111-4111-8111-111111111103'
  $$,
  'reopened past occurrence can be edited'
);
select results_eq(
  $$
    select count(*)
    from public.audit_events
    where entity_id = '11111111-1111-4111-8111-111111111103'
      and event_type in ('occurrence_completed', 'occurrence_reopened')
  $$,
  array[2::bigint],
  'completion and reopen are audited'
);

select lives_ok(
  $$
    select public.skip_occurrence(
      '11111111-1111-4111-8111-111111111103',
      null
    )
  $$,
  'owner can skip an upcoming occurrence'
);
select throws_ok(
  $$
    update public.occurrences
    set notes = 'direct edit while skipped'
    where id = '11111111-1111-4111-8111-111111111103'
  $$,
  '42501',
  'Completed, skipped, and archived occurrences are locked',
  'skipped occurrence is fully locked'
);

select has_table(
  'public',
  'rate_limit_events',
  'rate limit event table exists'
);
select is_definer(
  'public',
  'check_rate_limit',
  array['text', 'text', 'integer', 'integer'],
  'rate limit function is security definer'
);
select results_eq(
  $$select public.check_rate_limit('test_action', 'test@example.test', 2, 60)$$,
  array[true],
  'first request inside limit is allowed'
);
select results_eq(
  $$select public.check_rate_limit('test_action', 'test@example.test', 2, 60)$$,
  array[true],
  'second request inside limit is allowed'
);
select results_eq(
  $$select public.check_rate_limit('test_action', 'test@example.test', 2, 60)$$,
  array[false],
  'third request over limit is rejected'
);
select throws_ok(
  $$select count(*) from public.rate_limit_events$$,
  '42501',
  'permission denied for table rate_limit_events',
  'authenticated users cannot inspect rate limit events directly'
);

reset role;

select results_eq(
  $$select public from storage.buckets where id = 'account-icons'$$,
  array[false],
  'account icon storage bucket is private'
);
select results_eq(
  $$
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'account_icons_%'
  $$,
  array[4::bigint],
  'account icon storage has owner-scoped policies'
);

select * from finish();
rollback;
