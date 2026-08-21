-- =====================================================================
--  Manager / guard roles + in-app account management
-- =====================================================================
--  Adds a role table so the app can tell managers from guards, and so the
--  `manage-guards` edge function can verify the caller is a manager before
--  creating/disabling guard logins.
--
--  Run this in the Supabase SQL Editor, THEN edit the bootstrap statement at
--  the bottom to promote your own account to manager.
-- =====================================================================

create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'guard' check (role in ('manager', 'guard')),
  full_name  text,
  disabled   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- SECURITY DEFINER helper: is the current user an active manager?
create or replace function public.is_manager()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'manager' and disabled = false
  );
$$;

-- A user can always read their own role row; managers can read everyone's.
drop policy if exists "roles_select_self_or_manager" on public.user_roles;
create policy "roles_select_self_or_manager"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_manager());

-- Writes normally go through the edge function (service role, bypasses RLS),
-- but this lets a manager adjust rows directly too. Guards cannot write.
drop policy if exists "roles_write_manager" on public.user_roles;
create policy "roles_write_manager"
  on public.user_roles for all to authenticated
  using (public.is_manager())
  with check (public.is_manager());

-- ---------------------------------------------------------------------
--  BOOTSTRAP: promote your account to manager.
--  Replace the email with the account you created in Authentication -> Users.
-- ---------------------------------------------------------------------
insert into public.user_roles (user_id, role, full_name)
select id, 'manager', 'Primary Manager'
from auth.users
where email = 'YOUR_MANAGER_EMAIL@example.com'
on conflict (user_id) do update set role = 'manager', disabled = false;
