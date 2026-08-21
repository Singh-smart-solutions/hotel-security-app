-- =====================================================================
--  RLS HARDENING for hotel_security_logs / guard_shifts
-- =====================================================================
--
--  WHY: The tables in this project store PII (names, Emirates ID and
--  passport numbers, mobile numbers, nationalities, vehicle plates).
--  The frontend ships the Supabase ANON key in the browser bundle, so
--  that key is effectively public. If RLS policies use `USING (true)` /
--  `WITH CHECK (true)`, then ANYONE who opens the site (or reads the
--  bundle) can SELECT, INSERT and UPDATE every row in the security log.
--
--  This file locks the tables down to AUTHENTICATED users only. It
--  therefore REQUIRES that guards sign in via Supabase Auth first
--  (see SECURITY.md, item 2). Applying it without adding a login step
--  will (correctly) stop the anon-key app from reading/writing data.
--
--  Run it in the Supabase SQL Editor after enabling Supabase Auth.
-- =====================================================================

alter table public.hotel_security_logs enable row level security;
alter table public.guard_shifts        enable row level security;

-- Drop the permissive policies if they exist (names from the original setup).
drop policy if exists "Enable read access for authenticated users"   on public.hotel_security_logs;
drop policy if exists "Enable insert access for authenticated users" on public.hotel_security_logs;
drop policy if exists "Enable update access for authenticated users" on public.hotel_security_logs;

-- ---- hotel_security_logs: authenticated users only -------------------
create policy "logs_select_authenticated"
  on public.hotel_security_logs for select
  to authenticated
  using (true);

create policy "logs_insert_authenticated"
  on public.hotel_security_logs for insert
  to authenticated
  with check (true);

create policy "logs_update_authenticated"
  on public.hotel_security_logs for update
  to authenticated
  using (true)
  with check (true);

-- Deliberately NO delete policy: security logs should be append-only /
-- correctable, not deletable, from the app.

-- ---- guard_shifts: authenticated users only --------------------------
create policy "shifts_select_authenticated"
  on public.guard_shifts for select
  to authenticated
  using (true);

create policy "shifts_insert_authenticated"
  on public.guard_shifts for insert
  to authenticated
  with check (true);

create policy "shifts_update_authenticated"
  on public.guard_shifts for update
  to authenticated
  using (true)
  with check (true);
