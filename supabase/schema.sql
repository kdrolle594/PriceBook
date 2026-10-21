-- Shelf Check schema — run once in the Supabase SQL editor.
-- After signing up in the app, flag your account as admin:
--   update public.profiles set is_admin = true where email = 'you@example.com';

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.flyers (
  id uuid primary key default gen_random_uuid(),
  store text not null,
  start_date date not null,
  end_date date,
  item_count int not null default 0,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  canonical text not null unique,
  display text not null,
  size text not null default '',
  photo_path text, -- object in the item-photos bucket; null = no photo
  created_at timestamptz not null default now()
);

create table public.price_entries (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  flyer_id uuid references public.flyers(id) on delete cascade, -- null = manual sighting
  store text not null,
  start_date date not null,
  end_date date,
  price numeric(10,2) not null check (price > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (item_id, store, start_date)
);

-- auto-create profile on signup
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- admin check without recursive-RLS pain
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

alter table public.profiles enable row level security;
alter table public.flyers enable row level security;
alter table public.items enable row level security;
alter table public.price_entries enable row level security;

-- profiles: users read only their own row (keeps emails private); no client writes
create policy "profiles read own" on public.profiles for select to authenticated using (id = auth.uid());

-- data tables: public read (no account needed to browse prices); admin-only writes
create policy "flyers read"  on public.flyers        for select to anon, authenticated using (true);
create policy "flyers admin" on public.flyers        for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "items read"   on public.items         for select to anon, authenticated using (true);
create policy "items admin"  on public.items         for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "prices read"  on public.price_entries for select to anon, authenticated using (true);
create policy "prices admin" on public.price_entries for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- atomic flyer delete + orphan-item prune
create function public.delete_flyer(fid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  delete from public.flyers where id = fid; -- cascades price_entries
  delete from public.items i
    where not exists (select 1 from public.price_entries pe where pe.item_id = i.id);
end $$;

-- merge two items (AI canonical mismatches)
create function public.merge_items(source uuid, target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  delete from public.price_entries pe
    using public.price_entries t
    where pe.item_id = source and t.item_id = target
      and t.store = pe.store and t.start_date = pe.start_date;
  update public.price_entries set item_id = target where item_id = source;
  -- target keeps its own photo; inherits the source's when it has none
  update public.items t set photo_path = s.photo_path
    from public.items s
    where t.id = target and s.id = source and t.photo_path is null;
  delete from public.items where id = source;
end $$;

-- item photos: public bucket (anyone can view), admin-only uploads
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
