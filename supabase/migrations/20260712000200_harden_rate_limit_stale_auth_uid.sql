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
  v_user_id uuid;
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

  v_user_id := auth.uid();

  if v_user_id is not null and not exists (
    select 1
    from auth.users
    where id = v_user_id
  ) then
    v_user_id := null;
  end if;

  insert into public.rate_limit_events (
    user_id,
    action,
    identifier_hash
  )
  values (
    v_user_id,
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
