-- =====================================================================
--  C1.5 — Rate-limit / lock out guard PIN guessing
-- =====================================================================
--
--  WHY: guard PINs are 6 digits (1,000,000 combinations). After C1/C2 an
--  attacker can no longer read the pin_hash, but they can still OPEN an
--  anonymous session and call bind_guard_session() over and over to guess a
--  PIN online. This migration adds a lockout so a guard name is blocked after
--  a handful of wrong PINs, turning a fast online brute force into an
--  impractical one.
--
--  DB-ONLY. No app change: bind_guard_session already returns { error } which
--  the login screen shows, so the lockout message appears automatically.
--
--  Safe to run any time (it only tightens the existing PIN RPC).
--
--  TUNABLES (edit before running if you like):
--    * MAX_FAILS  = 5 failed attempts
--    * WINDOW     = 15 minutes rolling
-- =====================================================================

-- ── Attempt log (function-access only; no direct anon/authenticated reads) ──
create table if not exists public.guard_pin_attempts (
  id           bigint generated always as identity primary key,
  guard_name   text not null,
  user_id      uuid,
  succeeded    boolean not null,
  attempted_at timestamptz not null default now()
);
create index if not exists guard_pin_attempts_name_time_idx
  on public.guard_pin_attempts (guard_name, attempted_at);

alter table public.guard_pin_attempts enable row level security;
-- No policies on purpose: only the SECURITY DEFINER functions below touch it.

-- ── bind_guard_session(): now with lockout ──
create or replace function public.bind_guard_session(p_name text, p_pin_hash text)
returns json language plpgsql security definer set search_path = public
as $fn$
declare
  g       record;
  v_uid   uuid := auth.uid();
  v_fails int;
begin
  if v_uid is null then
    return json_build_object('success', false,
      'error', 'No authenticated session. Enable Anonymous sign-ins.');
  end if;

  -- Opportunistic cleanup so the table stays small.
  delete from public.guard_pin_attempts where attempted_at < now() - interval '1 day';

  -- Lockout: too many recent FAILED attempts for this guard name.
  select count(*) into v_fails
  from public.guard_pin_attempts
  where guard_name = p_name
    and succeeded = false
    and attempted_at > now() - interval '15 minutes';

  if v_fails >= 5 then
    return json_build_object('success', false,
      'error', 'Too many failed attempts. This guard is locked for up to 15 minutes.');
  end if;

  select id, name into g
  from public.guards
  where name = p_name and pin_hash = p_pin_hash and is_active = true;

  if not found then
    insert into public.guard_pin_attempts (guard_name, user_id, succeeded)
    values (p_name, v_uid, false);
    return json_build_object('success', false, 'error', 'Invalid name or PIN');
  end if;

  -- Success: record it and clear this guard's failure streak.
  insert into public.guard_pin_attempts (guard_name, user_id, succeeded)
  values (p_name, v_uid, true);
  delete from public.guard_pin_attempts
  where guard_name = p_name and succeeded = false;

  insert into public.guard_sessions (user_id, guard_id, guard_name)
  values (v_uid, g.id, g.name)
  on conflict (user_id) do update
    set guard_id = excluded.guard_id, guard_name = excluded.guard_name, verified_at = now();

  return json_build_object('success', true, 'guard_id', g.id, 'name', g.name);
end;
$fn$;
grant execute on function public.bind_guard_session(text, text) to authenticated;

-- ── clear_guard_lockout(): let a manager unlock a guard immediately ──
--    (Otherwise the lock auto-expires after the 15-minute window.)
create or replace function public.clear_guard_lockout(p_name text)
returns json language plpgsql security definer set search_path = public
as $fn$
begin
  if not public.is_manager() then
    return json_build_object('success', false, 'error', 'Manager access required');
  end if;
  delete from public.guard_pin_attempts where guard_name = p_name and succeeded = false;
  return json_build_object('success', true);
end;
$fn$;
grant execute on function public.clear_guard_lockout(text) to authenticated;

-- =====================================================================
--  RECOMMENDED COMPLEMENT (dashboard, not SQL): enable CAPTCHA for
--  Anonymous sign-ins (Supabase -> Authentication -> Providers). The
--  per-guard lockout above stops targeted guessing; captcha blunts an
--  attacker who rotates fresh anonymous sessions to dodge it.
--
--  MANAGER UNLOCK (if a guard gets locked out and can't wait 15 min):
--    select public.clear_guard_lockout('Sam');
-- =====================================================================
