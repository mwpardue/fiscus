create index if not exists recurrence_rules_user_status_mode_idx
  on public.recurrence_rules (user_id, status, mode);

create index if not exists occurrences_user_rule_archived_due_date_idx
  on public.occurrences (user_id, recurrence_rule_id, archived_at, due_date);

create or replace function public.get_recurrence_rule_occurrence_summaries()
returns table (
  recurrence_rule_id uuid,
  total_count integer,
  open_count integer,
  archived_count integer,
  first_due_date date,
  latest_due_date date
)
language sql
security invoker
set search_path = ''
as $$
  select
    occurrences.recurrence_rule_id,
    count(*)::integer as total_count,
    count(*) filter (
      where occurrences.archived_at is null
        and occurrences.lifecycle_status = 'upcoming'
    )::integer as open_count,
    count(*) filter (
      where occurrences.archived_at is not null
    )::integer as archived_count,
    min(occurrences.due_date) as first_due_date,
    max(occurrences.due_date) as latest_due_date
  from public.occurrences
  where occurrences.user_id = auth.uid()
    and occurrences.recurrence_rule_id is not null
  group by occurrences.recurrence_rule_id;
$$;

revoke execute on function public.get_recurrence_rule_occurrence_summaries()
  from public, anon;
grant execute on function public.get_recurrence_rule_occurrence_summaries()
  to authenticated;
