-- =====================================================================
--  C2 (step 1 of 2) — Guard authentication via anonymous session + PIN
-- =====================================================================
--
--  WHAT THIS DOES
--  Adds the server-side plumbing so the guard terminal can run under a real
--  Supabase Auth session instead of the shared public anon key:
--    * guard_sessions   — records which auth session passed PIN verification
--    * list_active_guards() — feeds the login dropdown WITHOUT exposing PII
--    * bind_guard_session() — verifies a PIN AND marks the session as a guard
--    * is_verified_guard()  — RLS helper used by the lockdown step
--
--  SAFE TO RUN ANY TIME. This step does NOT remove any existing anon access,
--  so nothing breaks when you run it. The actual lockdown is step 2
--  (supabase-c2-rls-lockdown.sql), which you run AFTER deploying the app.
--
--  PREREQUISITE: enable "Anonymous sign-ins" in
--  Supabase -> Authentication -> Providers.
-- =====================================================================

-- ── Roles table + manager helper (idempotent; mirrors ─────────────────
--    supabase-manager-roles.sql so the lockdown step can rely on it). ──
create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'guard' check (role in ('manager', 'guard')),
  full_name  text,
  disabled   boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;

create or replace function public.is_manager()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'manager' and disabled = false
  );
$$;

-- ── guard_sessions: an auth session that has passed PIN verification ──
create table if not exists public.guard_sessions (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  guard_id    uuid not null references public.guards (id) on delete cascade,
  guard_name  text not null,
  verified_at timestamptz not null default now()
);
alter table public.guard_sessions enable row level security;

-- A session may read only its own verification row. Writes happen only
-- through bind_guard_session() (SECURITY DEFINER) — no direct write policy.
drop policy if exists "gs_select_self" on public.guard_sessions;
create policy "gs_select_self" on public.guard_sessions
  for select to authenticated
  using (user_id = auth.uid());

-- ── list_active_guards(): dropdown source, no PII, callable pre-login ──
create or replace function public.list_active_guards()
returns table (id uuid, name text)
language sql security definer stable set search_path = public
as $$
  select id, name from public.guards where is_active = true order by name;
$$;
grant execute on function public.list_active_guards() to anon, authenticated;

-- ── bind_guard_session(): verify PIN AND mark this session as a guard ──
create or replace function public.bind_guard_session(p_name text, p_pin_hash text)
returns json
language plpgsql security definer set search_path = public
as $$
declare g record;
begin
  if auth.uid() is null then
    return json_build_object('success', false,
      'error', 'No authenticated session. Enable Anonymous sign-ins in Supabase Auth.');
  end if;

  select id, name into g
  from public.guards
  where name = p_name and pin_hash = p_pin_hash and is_active = true;

  if not found then
    return json_build_object('success', false, 'error', 'Invalid name or PIN');
  end if;

  insert into public.guard_sessions (user_id, guard_id, guard_name)
  values (auth.uid(), g.id, g.name)
  on conflict (user_id) do update
    set guard_id    = excluded.guard_id,
        guard_name  = excluded.guard_name,
        verified_at = now();

  return json_build_object('success', true, 'guard_id', g.id, 'name', g.name);
end;
$$;
-- Only real sessions may bind — deliberately NOT granted to anon.
grant execute on function public.bind_guard_session(text, text) to authenticated;

-- ── is_verified_guard(): RLS helper ──
create or replace function public.is_verified_guard()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (select 1 from public.guard_sessions where user_id = auth.uid());
$$;
grant execute on function public.is_verified_guard() to authenticated;

-- =====================================================================
--  NOTE: online PIN guessing is still possible here (an attacker can open
--  an anonymous session and call bind_guard_session repeatedly). That is no
--  worse than the pre-existing verify_guard_pin. A rate-limit / lockout is
--  tracked as a follow-up ("C1.5") and is a separate change.
-- =====================================================================
