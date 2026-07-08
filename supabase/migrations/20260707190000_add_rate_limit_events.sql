create table public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  action text not null,
  identifier_hash text not null,
  created_at timestamptz not null default now(),
  constraint rate_limit_events_action_not_blank check (btrim(action) <> ''),
  constraint rate_limit_events_identifier_hash_not_blank check (
    btrim(identifier_hash) <> ''
  )
);

create index rate_limit_events_lookup_idx
  on public.rate_limit_events (action, identifier_hash, created_at desc);

create index rate_limit_events_user_lookup_idx
  on public.rate_limit_events (user_id, action, created_at desc)
  where user_id is not null;

alter table public.rate_limit_events enable row level security;

revoke all on table public.rate_limit_events from anon, authenticated;

create or replace function public.check_rate_limit(
  p_action text,
  p_identifier text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identifier_hash text;
  v_window interval;
  v_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception using
      errcode = '22023',
      message = 'Invalid rate limit configuration';
  end if;

  if p_action is null or btrim(p_action) = '' then
    raise exception using
      errcode = '22023',
      message = 'Rate limit action is required';
  end if;

  v_identifier_hash := md5(lower(btrim(coalesce(p_identifier, 'anonymous'))));
  v_window := make_interval(secs => p_window_seconds);

  select count(*)
  into v_count
  from public.rate_limit_events
  where action = p_action
    and identifier_hash = v_identifier_hash
    and created_at >= now() - v_window;

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_events (
    user_id,
    action,
    identifier_hash
  )
  values (
    (select auth.uid()),
    p_action,
    v_identifier_hash
  );

  delete from public.rate_limit_events
  where created_at < now() - interval '7 days';

  return true;
end;
$$;

grant execute on function public.check_rate_limit(
  text,
  text,
  integer,
  integer
) to anon, authenticated;
