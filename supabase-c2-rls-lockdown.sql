-- =====================================================================
--  C2 (step 2 of 2) — Remove anonymous access to the PII tables
-- =====================================================================
--
--  This is the step that actually closes C2. It cuts the public anon key
--  off from hotel_security_logs / passes / guard_shifts and re-grants
--  access to VERIFIED GUARDS (sessions that passed a PIN) and MANAGERS only.
--
--  >>> RUN THIS ONLY AFTER: <<<
--    1. supabase-c2-guard-auth.sql has been run.
--    2. "Anonymous sign-ins" is enabled in Supabase Auth.
--    3. The guard-auth app changes are DEPLOYED, and you have confirmed a
--       guard can log in with their PIN and check a visitor in and out.
--    4. Your manager account has a user_roles row with role = 'manager'
--       (otherwise /admin loses access to the logs). Bootstrap with:
--          insert into public.user_roles (user_id, role, full_name)
--          select id, 'manager', 'Primary Manager' from auth.users
--          where email = 'YOUR_MANAGER_EMAIL@example.com'
--          on conflict (user_id) do update set role='manager', disabled=false;
--
--  Running it earlier will (correctly) stop the anon-key app from reading or
--  writing data. A full rollback is at the bottom of this file.
-- =====================================================================

-- Predicate used everywhere below: a PIN-verified guard OR a manager.
-- (is_verified_guard() and is_manager() come from supabase-c2-guard-auth.sql)

-- ── hotel_security_logs ──────────────────────────────────────────────
revoke all on public.hotel_security_logs from anon;
revoke all on public.hotel_security_logs from public;
grant select, insert, update on public.hotel_security_logs to authenticated;

alter table public.hotel_security_logs enable row level security;
drop policy if exists "anon_checkin_logs"          on public.hotel_security_logs;
drop policy if exists "anon_checkout_logs"         on public.hotel_security_logs;
drop policy if exists "anon_select_logs"           on public.hotel_security_logs;
drop policy if exists "logs_select_authenticated"  on public.hotel_security_logs;
drop policy if exists "logs_insert_authenticated"  on public.hotel_security_logs;
drop policy if exists "logs_update_authenticated"  on public.hotel_security_logs;

create policy "logs_select" on public.hotel_security_logs for select to authenticated
  using (public.is_verified_guard() or public.is_manager());
create policy "logs_insert" on public.hotel_security_logs for insert to authenticated
  with check (public.is_verified_guard() or public.is_manager());
create policy "logs_update" on public.hotel_security_logs for update to authenticated
  using (public.is_verified_guard() or public.is_manager())
  with check (public.is_verified_guard() or public.is_manager());
-- No delete policy: security logs stay append-only from the app.

-- ── passes ───────────────────────────────────────────────────────────
revoke all on public.passes from anon;
revoke all on public.passes from public;
grant select, update on public.passes to authenticated;

alter table public.passes enable row level security;
drop policy if exists "anon_read_passes"        on public.passes;
drop policy if exists "anon_update_pass_status" on public.passes;

create policy "passes_select" on public.passes for select to authenticated
  using (public.is_verified_guard() or public.is_manager());
create policy "passes_update" on public.passes for update to authenticated
  using (public.is_verified_guard() or public.is_manager())
  with check (public.is_verified_guard() or public.is_manager());
-- The manager "managers_full_access_passes" policy (from supabase-phase2.sql)
-- remains and covers pass creation/deletion by managers.

-- ── guard_shifts ─────────────────────────────────────────────────────
revoke all on public.guard_shifts from anon;
revoke all on public.guard_shifts from public;
grant select, insert, update on public.guard_shifts to authenticated;

alter table public.guard_shifts enable row level security;
drop policy if exists "anon_shifts"                on public.guard_shifts;
drop policy if exists "shifts_select_authenticated" on public.guard_shifts;
drop policy if exists "shifts_insert_authenticated" on public.guard_shifts;
drop policy if exists "shifts_update_authenticated" on public.guard_shifts;

create policy "shifts_select" on public.guard_shifts for select to authenticated
  using (public.is_verified_guard() or public.is_manager());
create policy "shifts_insert" on public.guard_shifts for insert to authenticated
  with check (public.is_verified_guard() or public.is_manager());
create policy "shifts_update" on public.guard_shifts for update to authenticated
  using (public.is_verified_guard() or public.is_manager())
  with check (public.is_verified_guard() or public.is_manager());

-- Optional: retire the old anon PIN RPC now that bind_guard_session replaces it.
-- revoke execute on function public.verify_guard_pin(text, text) from anon;

-- =====================================================================
--  VERIFY (as anon — the public key must now be blind to PII):
--    set role anon;
--    select * from public.hotel_security_logs limit 1;  -- expect: 0 rows / denied
--    reset role;
--
--  ROLLBACK (re-open to anon if something breaks in production):
--    grant select, insert, update on public.hotel_security_logs to anon;
--    grant select, update       on public.passes             to anon;
--    grant select, insert, update on public.guard_shifts      to anon;
--    -- and recreate the anon_* policies from supabase-phase2.sql
-- =====================================================================
