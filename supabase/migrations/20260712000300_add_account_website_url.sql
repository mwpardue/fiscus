alter table public.counterparties
  add column website_url text;

alter table public.counterparties
  add constraint counterparties_website_url_valid check (
    website_url is null or website_url ~ '^https?://[^[:space:]]+$'
  );
