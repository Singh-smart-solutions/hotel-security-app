-- =====================================================================
--  C1 FIX — Hide guards.pin_hash from the public (anon) key
--  Runs in Supabase SQL Editor. No frontend/app changes required.
--  App still reads id, name, is_active as anon; pin_hash becomes
--  unreadable to anon while verify_guard_pin (SECURITY DEFINER) keeps
--  working for login.
-- =====================================================================

-- 1. Make sure row-level security is actually on for this table.
alter table public.guards enable row level security;

-- 2. Remove the blanket table-wide SELECT the anon role currently has,
--    then grant back ONLY the columns the login dropdown needs.
--    (pin_hash is deliberately excluded.)
revoke select on public.guards from anon;
grant  select (id, name, is_active) on public.guards to anon;

-- 3. Allow anon to see only the rows it needs (active guards) for the
--    login dropdown. Column grants above still hide pin_hash.
drop policy if exists "anon_read_guard_directory" on public.guards;
create policy "anon_read_guard_directory"
  on public.guards
  for select
  to anon
  using (is_active = true);

-- NOTE: the 'authenticated' role (managers) is left untouched, so the
-- Manager Portal's Staff tab keeps working exactly as before.
