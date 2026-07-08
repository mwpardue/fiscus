alter table public.profiles
  alter column theme_token set default 'alteraest-light';

alter table public.profiles
  drop constraint profiles_theme_token_valid;

alter table public.profiles
  add constraint profiles_theme_token_valid check (
    theme_token in (
      'alteraest-light',
      'alteraest-dark',
      'catppuccin-mocha',
      'catppuccin-latte',
      'tokyo-night',
      'gruvbox-dark',
      'dracula',
      'nord',
      'solarized-dark'
    )
  );
