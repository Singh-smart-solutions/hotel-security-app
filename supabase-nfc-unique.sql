-- =====================================================================
--  NFC tag ↔ pass: one tag = one pass (fix duplicate links)
-- =====================================================================
--  A tag had been linked to several passes at once. The guard lookup
--  expects a tag to match exactly one pass, so multiple matches made it
--  report "NFC tag not registered". This:
--    1. Clears the duplicated tag off every pass, then re-links it to a
--       single pass (V-014 — change if you want a different one).
--    2. Adds a unique index so a tag can never be linked to two passes
--       again at the database level.
--
--  Safe to run / re-run.
-- =====================================================================

-- 1. Clean up the current duplicates: keep the tag on ONE pass only.
update public.passes set nfc_uid = null  where nfc_uid = '04F38A79B82A81';
update public.passes set nfc_uid = '04F38A79B82A81' where pass_number = 'V-014';

-- 2. Enforce one-tag-one-pass going forward.
create unique index if not exists passes_nfc_uid_unique
  on public.passes (nfc_uid) where nfc_uid is not null;

-- =====================================================================
--  VERIFY (should return exactly one row — V-014):
--    select pass_number, nfc_uid from public.passes
--    where nfc_uid = '04F38A79B82A81';
-- =====================================================================
