update public.profiles
set theme_token = 'alteraest-light'
where theme_token not in ('alteraest-light', 'alteraest-dark');

alter table public.profiles
  alter column theme_token set default 'alteraest-light';

alter table public.profiles
  drop constraint if exists profiles_theme_token_valid;

alter table public.profiles
  add constraint profiles_theme_token_valid check (
    theme_token in (
      'alteraest-light',
      'alteraest-dark'
    )
  );
