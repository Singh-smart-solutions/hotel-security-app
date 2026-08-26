-- =====================================================================
--  Post-audit hardening + data retention
-- =====================================================================
--  Records changes applied directly in the Supabase SQL Editor after the
--  main migrations, so the repository matches production:
--
--    1. Data retention — auto-delete checked-out records older than 30 days
--       (keeps anyone still 'inside'), run daily by pg_cron.
--    2. F1 — drop the unused legacy verify_guard_pin() function, which was
--       still callable by anon with no lockout and therefore bypassed the
--       PIN rate-limit added in supabase-c1_5-pin-rate-limit.sql.
--    3. F2 — lock the retention function so only the scheduler/owner can run
--       it (Postgres grants EXECUTE to PUBLIC by default).
--
--  Safe to run / re-run. Requires the pg_cron extension (enable it under
--  Database -> Extensions).
-- =====================================================================

-- ── 1. Retention: purge old checked-out logs ─────────────────────────
create or replace function public.purge_old_security_logs()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.hotel_security_logs
  where status = 'checked_out'
    and check_in_time < now() - interval '30 days';
$$;

-- Daily at 02:30 UTC (06:30 Dubai). Re-running updates the existing job.
select cron.schedule(
  'purge-old-security-logs',
  '30 2 * * *',
  $$ select public.purge_old_security_logs(); $$
);

-- ── 2. F1: remove the legacy PIN function (replaced by bind_guard_session) ──
--    It was granted to anon and had no lockout, so it re-opened the online
--    PIN brute-force vector that C1.5 closed. Nothing uses it any more.
drop function if exists public.verify_guard_pin(text, text);

-- ── 3. F2: only the scheduler/owner may run the retention purge ──────
revoke execute on function public.purge_old_security_logs() from public, anon, authenticated;

-- =====================================================================
--  To adjust the retention window, change the interval above and re-run
--  the function block. To pause the job:
--    select cron.unschedule('purge-old-security-logs');
--  To verify the schedule:
--    select jobname, schedule, active from cron.job;
-- =====================================================================
