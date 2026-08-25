# C3 — Server-side workflow integrity (overstay lock, pass/person contention, force-close)

**Problem:** the overstay checkout lock and pass double-issue prevention lived
only in the browser, so a direct API call could bypass them. Overstayed
visitors also got stuck `inside` forever, and the same person could be checked
in twice.

**Fix:** enforce it all in the database via SECURITY DEFINER functions the app
calls instead of writing to tables directly:

- `check_in_visitor(p)` — refuses if the **person (doc number)** is already
  inside or the **pass** is already in use; then logs the entry + marks the
  pass in-use, atomically.
- `check_out_visitor(log_id, guard)` — refuses to check out an **overstayed**
  visitor (re-locks after an extension is itself overstayed); frees the pass.
- `grant_extension(log_id, hours, reason, approver)` — **manager-only**;
  records a real `extensions` row and raises allowed time.
- `manager_force_checkout(log_id, reason)` — **manager-only**; closes a stuck
  `inside` record and frees its pass.
- Partial unique indexes so a pass / person can't be active twice even under a race.

## Files
- `supabase-c3-workflow-integrity.sql` — tables + functions. Safe any time.
- `supabase-c3-constraints.sql` — the unique indexes. **Run last, after cleanup.**
- App: `GuardPage.jsx` (check-in/checkout via RPCs), `AdminPage.jsx` (extend via
  RPC + manager **Force Out** button in the Logs tab).

## Deploy order

1. **Run `supabase-c3-workflow-integrity.sql`** in the SQL Editor (nothing breaks yet).
2. **Merge & deploy** this PR. Verify on the live app:
   - Guard check-in still works; checking in the **same ID twice** is refused;
     an in-use pass is refused.
   - Guard checkout works for on-time visitors; an **overstayed** visitor is
     refused with a manager message.
   - Manager Logs tab: **+ Extend** works; **Force Out** closes a record.
3. **Clean up existing stale/duplicate `inside` records** (required before the
   constraints will build). Find them:
   ```sql
   -- same pass held by more than one active visitor
   select pass_badge_no, count(*) from public.hotel_security_logs
   where status='inside' and pass_badge_no <> 'CASUAL'
   group by pass_badge_no having count(*) > 1;

   -- same person active more than once
   select doc_number, count(*) from public.hotel_security_logs
   where status='inside' and doc_number is not null
   group by doc_number having count(*) > 1;

   -- everyone still 'inside' from before today (likely left already)
   select id, full_name, pass_badge_no, check_in_time
   from public.hotel_security_logs
   where status='inside' order by check_in_time;
   ```
   Close the ones who actually left using the **Force Out** button in the Logs
   tab (or the manager RPC). Re-run the first two queries until they return 0 rows.
4. **Run `supabase-c3-constraints.sql`.** If it errors with a uniqueness
   violation, there are still duplicates from step 3 — clean them and re-run.
5. **Verify** a guard cannot bypass: try to double-issue a pass or re-check-in
   the same ID — both should be refused.

## Notes
- After this, the `[Ext …]` text in `purpose_of_visit` is **display-only**; the
  checkout lock relies on `allowed_hours`, so typing `[Ext` no longer bypasses
  anything (closes H4). Extensions are the source of truth in the `extensions` table.
- `allowed_hours` is still chosen by the guard at check-in (by design). A guard
  setting an unusually long duration is a policy/training matter, visible to
  managers in the logs.
