-- Hardening upgrade for projects that already ran schema.sql.
-- Run once in the Supabase SQL editor. (Fresh installs get all of this
-- from schema.sql directly.)

-- 1. Profiles: only your own row is readable — stops any signed-in user
--    (including guests) from listing everyone's email address.
drop policy "profiles read" on public.profiles;
create policy "profiles read own" on public.profiles
  for select to authenticated using (id = auth.uid());

-- 2. Prices must be positive — a buggy client can't write $0.00 rows.
alter table public.price_entries
  add constraint price_entries_price_positive check (price > 0);
