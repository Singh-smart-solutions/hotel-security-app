-- =====================================================================
--  Blacklist photo — optional photo per blacklisted person
-- =====================================================================
--  Only people the manager blacklists get a photo (added when blacklisting),
--  so the guard can visually confirm a blocked person at the gate. Normal
--  visitors are never photographed. The photo is stored compressed on the
--  blacklist row (a small JPEG data URL) — no storage bucket needed.
--
--  Safe to run / re-run.
-- =====================================================================

alter table public.blacklist
  add column if not exists photo text;
