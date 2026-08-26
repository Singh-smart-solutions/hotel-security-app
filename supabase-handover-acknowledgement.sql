-- =====================================================================
--  Shift handover — read & accept acknowledgement
-- =====================================================================
--  The incoming guard must tick "I have read and accept this handover"
--  before starting a shift. When they do, the app stamps the PREVIOUS
--  (completed) shift with who accepted it and when, and the Manager
--  "Handovers" tab shows that acknowledgement.
--
--  This adds the two columns those stamps live in. No new policy is
--  needed: the existing "shifts_update" policy already lets a verified
--  guard (or manager) update guard_shifts rows.
--
--  Safe to run / re-run.
-- =====================================================================

alter table public.guard_shifts
  add column if not exists acknowledged_by text,
  add column if not exists acknowledged_at timestamptz;

-- =====================================================================
--  VERIFY:
--    select id, guard_name, gate_location, acknowledged_by, acknowledged_at
--    from public.guard_shifts
--    order by end_time desc nulls last
--    limit 10;
-- =====================================================================
