-- =====================================================================
--  C3 (step 1) — Server-side workflow integrity
-- =====================================================================
--  Moves the overstay lock, pass double-issue prevention, duplicate
--  check-in prevention, extensions, and manager force-close OUT of the
--  browser and INTO the database, so they hold no matter who calls the API.
--
--  All logic runs in SECURITY DEFINER functions the app calls instead of
--  writing to the tables directly. Safe to run any time; behavior only
--  changes once the app is deployed to use these functions.
--
--  Requires is_manager() / is_verified_guard() from the C1.5 / C2 migrations.
-- =====================================================================

-- ── extensions: the real record behind a granted extension (replaces the
--    forgeable "[Ext ...]" text tag) ──
create table if not exists public.extensions (
  id          bigint generated always as identity primary key,
  log_id      uuid not null references public.hotel_security_logs (id) on delete cascade,
  added_hours numeric not null check (added_hours > 0),
  reason      text not null,
  approver    text not null,
  granted_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists extensions_log_id_idx on public.extensions (log_id);
alter table public.extensions enable row level security;
drop policy if exists "extensions_select" on public.extensions;
create policy "extensions_select" on public.extensions for select to authenticated
  using (public.is_verified_guard() or public.is_manager());
-- Writes go only through grant_extension() (SECURITY DEFINER).

-- ── check_in_visitor(): atomic check-in with contention guards ──
create or replace function public.check_in_visitor(p jsonb)
returns json language plpgsql security definer set search_path = public
as $fn$
declare
  v_pass text := p->>'pass_badge_no';
  v_doc  text := p->>'doc_number';
  v_id   uuid;
begin
  if not (public.is_verified_guard() or public.is_manager()) then
    return json_build_object('success', false, 'error', 'Not authorized');
  end if;

  -- 1. Same person already inside? (all categories)
  if v_doc is not null and exists (
       select 1 from public.hotel_security_logs
       where doc_number = v_doc and status = 'inside') then
    return json_build_object('success', false,
      'error', 'This person is already checked in and still inside. Check them out first.');
  end if;

  -- 2. Pass already in use? (real passes only, not CASUAL)
  if v_pass is not null and v_pass <> 'CASUAL' and exists (
       select 1 from public.hotel_security_logs
       where pass_badge_no = v_pass and status = 'inside') then
    return json_build_object('success', false,
      'error', 'Pass ' || v_pass || ' is already issued to someone inside.');
  end if;

  insert into public.hotel_security_logs (
    shift_id, logged_by_guard, full_name, doc_number, mobile_number, company_name,
    vehicle_plate, nationality, id_expiry_date, traffic_type, purpose_of_visit,
    host_room_or_dept, pass_badge_no, allowed_hours, status
  ) values (
    (p->>'shift_id')::uuid, p->>'logged_by_guard', p->>'full_name', v_doc,
    p->>'mobile_number', p->>'company_name', p->>'vehicle_plate', p->>'nationality',
    nullif(p->>'id_expiry_date','')::date, p->>'traffic_type', p->>'purpose_of_visit',
    p->>'host_room_or_dept', v_pass, (p->>'allowed_hours')::numeric, 'inside'
  ) returning id into v_id;

  if v_pass is not null and v_pass <> 'CASUAL' then
    update public.passes set status = 'in_use' where pass_number = v_pass;
  end if;

  return json_build_object('success', true, 'id', v_id);
exception
  when unique_violation then
    -- The partial unique indexes (step 2) caught a race we lost.
    return json_build_object('success', false,
      'error', 'That pass was just taken, or this person is already inside. Refresh and retry.');
end;
$fn$;
grant execute on function public.check_in_visitor(jsonb) to authenticated;

-- ── check_out_visitor(): server-enforced overstay lock (re-locks after an
--    extension is itself overstayed) ──
create or replace function public.check_out_visitor(p_log_id uuid, p_guard text)
returns json language plpgsql security definer set search_path = public
as $fn$
declare
  r         record;
  v_elapsed numeric;
begin
  if not (public.is_verified_guard() or public.is_manager()) then
    return json_build_object('success', false, 'error', 'Not authorized');
  end if;

  select * into r from public.hotel_security_logs where id = p_log_id;
  if not found then return json_build_object('success', false, 'error', 'Record not found'); end if;
  if r.status <> 'inside' then return json_build_object('success', false, 'error', 'Already checked out'); end if;

  v_elapsed := extract(epoch from (now() - r.check_in_time)) / 3600.0;
  if v_elapsed > coalesce(r.allowed_hours, 2) then
    return json_build_object('success', false, 'overstay', true,
      'error', 'Overstayed — a manager must extend the time or force-close before checkout.');
  end if;

  update public.hotel_security_logs
    set status = 'checked_out', check_out_time = now(), checkout_by_guard = p_guard
    where id = p_log_id;

  if r.pass_badge_no is not null and r.pass_badge_no <> 'CASUAL' then
    update public.passes set status = 'available' where pass_number = r.pass_badge_no;
  end if;

  return json_build_object('success', true);
end;
$fn$;
grant execute on function public.check_out_visitor(uuid, text) to authenticated;

-- ── grant_extension(): manager-only; records a real extension + raises time ──
create or replace function public.grant_extension(p_log_id uuid, p_hours numeric, p_reason text, p_approver text)
returns json language plpgsql security definer set search_path = public
as $fn$
declare r record;
begin
  if not public.is_manager() then
    return json_build_object('success', false, 'error', 'Manager access required');
  end if;
  if p_hours is null or p_hours <= 0 then
    return json_build_object('success', false, 'error', 'Extension hours must be greater than 0');
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    return json_build_object('success', false, 'error', 'Reason is required');
  end if;
  if p_approver is null or btrim(p_approver) = '' then
    return json_build_object('success', false, 'error', 'Approver is required');
  end if;

  select * into r from public.hotel_security_logs where id = p_log_id;
  if not found then return json_build_object('success', false, 'error', 'Record not found'); end if;

  insert into public.extensions (log_id, added_hours, reason, approver, granted_by)
  values (p_log_id, p_hours, btrim(p_reason), btrim(p_approver), auth.uid());

  update public.hotel_security_logs
    set allowed_hours = coalesce(allowed_hours, 2) + p_hours,
        -- keep a human-readable note for the existing UI (display only; the
        -- checkout lock relies on allowed_hours, not this text)
        purpose_of_visit = coalesce(purpose_of_visit, 'Standard Entry')
          || ' [Ext +' || p_hours || 'h | Reason: ' || btrim(p_reason)
          || ' | Approved By: ' || btrim(p_approver) || ' (Manager Portal)]'
    where id = p_log_id;

  return json_build_object('success', true,
    'new_allowed_hours', coalesce(r.allowed_hours, 2) + p_hours);
end;
$fn$;
grant execute on function public.grant_extension(uuid, numeric, text, text) to authenticated;

-- ── manager_force_checkout(): manager-only; closes any stuck 'inside' record ──
create or replace function public.manager_force_checkout(p_log_id uuid, p_reason text)
returns json language plpgsql security definer set search_path = public
as $fn$
declare r record;
begin
  if not public.is_manager() then
    return json_build_object('success', false, 'error', 'Manager access required');
  end if;
  select * into r from public.hotel_security_logs where id = p_log_id;
  if not found then return json_build_object('success', false, 'error', 'Record not found'); end if;
  if r.status <> 'inside' then return json_build_object('success', false, 'error', 'Already checked out'); end if;

  update public.hotel_security_logs
    set status = 'checked_out', check_out_time = now(),
        checkout_by_guard = 'MANAGER FORCE-CLOSE'
          || case when coalesce(btrim(p_reason),'') <> '' then ': ' || btrim(p_reason) else '' end
    where id = p_log_id;

  if r.pass_badge_no is not null and r.pass_badge_no <> 'CASUAL' then
    update public.passes set status = 'available' where pass_number = r.pass_badge_no;
  end if;

  return json_build_object('success', true);
end;
$fn$;
grant execute on function public.manager_force_checkout(uuid, text) to authenticated;
