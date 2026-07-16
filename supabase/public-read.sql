-- Migration for projects that already ran schema.sql before reads went public.
-- Run once in the Supabase SQL editor. New projects don't need this —
-- schema.sql already creates the public read policies.

drop policy "flyers read"  on public.flyers;
drop policy "items read"   on public.items;
drop policy "prices read"  on public.price_entries;

create policy "flyers read"  on public.flyers        for select to anon, authenticated using (true);
create policy "items read"   on public.items         for select to anon, authenticated using (true);
create policy "prices read"  on public.price_entries for select to anon, authenticated using (true);
