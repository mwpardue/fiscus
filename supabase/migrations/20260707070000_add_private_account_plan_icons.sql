alter table public.counterparties
  add column icon_storage_path text,
  add column icon_updated_at timestamptz;

alter table public.financial_items
  add column icon_storage_path text,
  add column icon_updated_at timestamptz;

alter table public.counterparties
  add constraint counterparties_icon_storage_path_not_blank check (
    icon_storage_path is null or btrim(icon_storage_path) <> ''
  );

alter table public.financial_items
  add constraint financial_items_icon_storage_path_not_blank check (
    icon_storage_path is null or btrim(icon_storage_path) <> ''
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'account-icons',
  'account-icons',
  false,
  1048576,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy account_icons_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'account-icons'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy account_icons_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'account-icons'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy account_icons_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'account-icons'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'account-icons'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy account_icons_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'account-icons'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

grant update (
  icon_storage_path,
  icon_updated_at
) on table public.counterparties to authenticated;

grant update (
  icon_storage_path,
  icon_updated_at
) on table public.financial_items to authenticated;
