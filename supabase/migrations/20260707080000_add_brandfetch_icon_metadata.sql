alter table public.counterparties
  add column brandfetch_brand_id text,
  add column brandfetch_domain text,
  add column brandfetch_name text,
  add column brandfetch_icon_url text,
  add column brandfetch_updated_at timestamptz;

alter table public.financial_items
  add column brandfetch_brand_id text,
  add column brandfetch_domain text,
  add column brandfetch_name text,
  add column brandfetch_icon_url text,
  add column brandfetch_updated_at timestamptz;

alter table public.counterparties
  add constraint counterparties_brandfetch_domain_not_blank check (
    brandfetch_domain is null or btrim(brandfetch_domain) <> ''
  ),
  add constraint counterparties_brandfetch_icon_url_not_blank check (
    brandfetch_icon_url is null or btrim(brandfetch_icon_url) <> ''
  );

alter table public.financial_items
  add constraint financial_items_brandfetch_domain_not_blank check (
    brandfetch_domain is null or btrim(brandfetch_domain) <> ''
  ),
  add constraint financial_items_brandfetch_icon_url_not_blank check (
    brandfetch_icon_url is null or btrim(brandfetch_icon_url) <> ''
  );

grant update (
  brandfetch_brand_id,
  brandfetch_domain,
  brandfetch_name,
  brandfetch_icon_url,
  brandfetch_updated_at
) on table public.counterparties to authenticated;

grant update (
  brandfetch_brand_id,
  brandfetch_domain,
  brandfetch_name,
  brandfetch_icon_url,
  brandfetch_updated_at
) on table public.financial_items to authenticated;
