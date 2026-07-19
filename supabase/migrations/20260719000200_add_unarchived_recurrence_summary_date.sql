drop function public.get_recurrence_rule_occurrence_summaries();

create function public.get_recurrence_rule_occurrence_summaries()
returns table (
  recurrence_rule_id uuid,
  total_count integer,
  open_count integer,
  archived_count integer,
  first_due_date date,
  latest_due_date date,
  latest_unarchived_due_date date
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
    max(occurrences.due_date) as latest_due_date,
    max(occurrences.due_date) filter (
      where occurrences.archived_at is null
    ) as latest_unarchived_due_date
  from public.occurrences
  where occurrences.user_id = auth.uid()
    and occurrences.recurrence_rule_id is not null
  group by occurrences.recurrence_rule_id;
$$;
