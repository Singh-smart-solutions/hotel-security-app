-- =====================================================================
--  C3 (step 2) — Race-proof uniqueness constraints
-- =====================================================================
--  Backstop for check_in_visitor: even under a simultaneous double-tap
--  across two gates, the database itself refuses a second active row for
--  the same pass or the same person.
--
--  >>> RUN THIS ONLY AFTER cleaning up existing duplicate / stale 'inside'
--      records <<< — otherwise the CREATE INDEX will fail. See the cleanup
--      queries in C3_MIGRATION.md (use the manager Force Check-Out button,
--      then re-run this file).
-- =====================================================================

-- One physical pass can be 'inside' for at most one person (CASUAL excluded).
create unique index if not exists uniq_active_pass
  on public.hotel_security_logs (pass_badge_no)
  where status = 'inside' and pass_badge_no is not null and pass_badge_no <> 'CASUAL';

-- One person (by document number) can be 'inside' at most once.
create unique index if not exists uniq_active_person
  on public.hotel_security_logs (doc_number)
  where status = 'inside' and doc_number is not null;
