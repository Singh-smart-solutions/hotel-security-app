-- =====================================================================
--  Manager blacklist — block flagged people at the gate
-- =====================================================================
--  A manager can blacklist a person (by ID/document number and/or mobile)
--  with a reason. When a guard enters/scans that ID or mobile at check-in,
--  the entry is blocked — in the UI and, as a backstop, in the server
--  check_in_visitor function so it cannot be bypassed from the browser.
--
--  Safe to run / re-run.
-- =====================================================================

-- ── 1. Blacklist table ───────────────────────────────────────────────
create table if not exists public.blacklist (
  id              bigint generated always as identity primary key,
  doc_number      text,
  full_name       text,
  mobile_number   text,
  reason          text not null,
  blacklisted_by  text,
  blacklisted_at  timestamptz not null default now(),
  is_active       boolean not null default true
);

create index if not exists blacklist_doc_idx
  on public.blacklist (lower(doc_number)) where is_active;
create index if not exists blacklist_mobile_idx
  on public.blacklist (mobile_number) where is_active;

alter table public.blacklist enable row level security;
revoke all on public.blacklist from anon, public;
grant select, insert, update, delete on public.blacklist to authenticated;

-- Verified guards + managers can READ (to check at the gate).
-- Only managers can ADD / EDIT / REMOVE entries.
drop policy if exists "bl_select" on public.blacklist;
drop policy if exists "bl_insert" on public.blacklist;
drop policy if exists "bl_update" on public.blacklist;
drop policy if exists "bl_delete" on public.blacklist;

create policy "bl_select" on public.blacklist for select to authenticated
  using (public.is_verified_guard() or public.is_manager());
create policy "bl_insert" on public.blacklist for insert to authenticated
  with check (public.is_manager());
create policy "bl_update" on public.blacklist for update to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy "bl_delete" on public.blacklist for delete to authenticated
  using (public.is_manager());

-- ── 2. Re-create check_in_visitor WITH a blacklist guard ─────────────
create or replace function public.check_in_visitor(p jsonb)
returns json language plpgsql security definer set search_path = public
as $fn$
declare
  v_pass text := p->>'pass_badge_no';
  v_doc  text := p->>'doc_number';
  v_mob  text := p->>'mobile_number';
  v_bl   record;
  v_id   uuid;
begin
  if not (public.is_verified_guard() or public.is_manager()) then
    return json_build_object('success', false, 'error', 'Not authorized');
  end if;

  -- 0. Blacklisted? Block the entry (matches on ID/document or mobile).
  select reason, blacklisted_at into v_bl
  from public.blacklist
  where is_active
    and ( (v_doc is not null and v_doc <> '' and lower(doc_number) = lower(v_doc))
       or (v_mob is not null and v_mob <> '' and mobile_number = v_mob) )
  order by blacklisted_at desc
  limit 1;
  if found then
    return json_build_object('success', false,
      'error', 'BLACKLISTED — entry blocked by manager. Reason: '
               || coalesce(v_bl.reason, 'n/a')
               || ' (since ' || to_char(v_bl.blacklisted_at, 'DD Mon YYYY') || ')');
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
    v_mob, p->>'company_name', p->>'vehicle_plate', p->>'nationality',
    nullif(p->>'id_expiry_date','')::date,
    (p->>'traffic_type')::hotel_traffic_type,
    p->>'purpose_of_visit',
    p->>'host_room_or_dept', v_pass, (p->>'allowed_hours')::numeric, 'inside'
  ) returning id into v_id;

  if v_pass is not null and v_pass <> 'CASUAL' then
    update public.passes set status = 'in_use' where pass_number = v_pass;
  end if;

  return json_build_object('success', true, 'id', v_id);
exception
  when unique_violation then
    return json_build_object('success', false,
      'error', 'That pass was just taken, or this person is already inside. Refresh and retry.');
end;
$fn$;
grant execute on function public.check_in_visitor(jsonb) to authenticated;

-- =====================================================================
--  VERIFY:
--    select full_name, doc_number, reason, blacklisted_at from public.blacklist;
-- =====================================================================
