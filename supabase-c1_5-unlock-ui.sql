-- =====================================================================
--  C1.5 (UI helper) — list currently locked-out guards, for the Staff tab
-- =====================================================================
--  Lets the Manager Portal show a "LOCKED" badge + Unlock button for guards
--  that have tripped the PIN lockout (see supabase-c1_5-pin-rate-limit.sql).
--  Manager-gated; returns nothing to non-managers.
--
--  Safe to run any time. No effect on access to any other table.
-- =====================================================================

create or replace function public.list_locked_guards()
returns table (guard_name text)
language plpgsql security definer stable set search_path = public
as $fn$
begin
  if not public.is_manager() then
    return;
  end if;
  return query
    select a.guard_name
    from public.guard_pin_attempts a
    where a.succeeded = false
      and a.attempted_at > now() - interval '15 minutes'
    group by a.guard_name
    having count(*) >= 5;
end;
$fn$;
grant execute on function public.list_locked_guards() to authenticated;
