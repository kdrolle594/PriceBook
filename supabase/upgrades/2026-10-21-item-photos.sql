-- Item photos upgrade for projects that already ran schema.sql.
-- Run once in the Supabase SQL editor. (Fresh installs get all of this
-- from schema.sql directly.)

-- 1. Each item can point at one photo in the item-photos bucket.
alter table public.items add column photo_path text;

-- 2. Public bucket so anyone browsing sees photos; only admins write.
insert into storage.buckets (id, name, public) values ('item-photos', 'item-photos', true);
-- storage's delete/replace calls look rows up first, so admins need select too
create policy "item photos admin select" on storage.objects for select to authenticated
  using (bucket_id = 'item-photos' and public.is_admin());
create policy "item photos admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'item-photos' and public.is_admin());
create policy "item photos admin update" on storage.objects for update to authenticated
  using (bucket_id = 'item-photos' and public.is_admin())
  with check (bucket_id = 'item-photos' and public.is_admin());
create policy "item photos admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'item-photos' and public.is_admin());

-- 3. Merging duplicates keeps a photo when only the source had one.
create or replace function public.merge_items(source uuid, target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  delete from public.price_entries pe
    using public.price_entries t
    where pe.item_id = source and t.item_id = target
      and t.store = pe.store and t.start_date = pe.start_date;
  update public.price_entries set item_id = target where item_id = source;
  update public.items t set photo_path = s.photo_path
    from public.items s
    where t.id = target and s.id = source and t.photo_path is null;
  delete from public.items where id = source;
end $$;
