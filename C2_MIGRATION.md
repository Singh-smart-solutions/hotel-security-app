# C2 Fix — Remove anonymous access to visitor PII

**Problem (C2):** the guard terminal talks to Supabase using the public **anon
key**, which ships in the browser bundle. The RLS policies grant `anon` full
`SELECT/INSERT/UPDATE` on `hotel_security_logs`, `passes`, and `guard_shifts`,
so **anyone with that key can read and tamper with every visitor record**
(Emirates ID / passport numbers, mobile numbers, nationalities).

**Fix (this PR):** give the guard terminal a real Supabase Auth session via
**anonymous sign-in**, bind that session to a guard through **PIN
verification**, and then lock the PII tables so only **verified guards** and
**managers** can touch them. UX is unchanged — guards still pick their name and
enter a 6-digit PIN.

---

## What changed

**App**
- `src/supabaseClient.js` — persists the auth session and adds
  `ensureAnonSession()` (anonymous sign-in).
- `src/pages/GuardPage.jsx` — establishes the session on load, reads the login
  dropdown via the new `list_active_guards()` RPC, verifies the PIN via the new
  `bind_guard_session()` RPC, drops the session on logout, and re-checks
  verification on reload.

**Database (SQL, run in the Supabase SQL Editor)**
- `supabase-c2-guard-auth.sql` — the RPCs + `guard_sessions` table. **Safe to
  run any time; changes no existing access.**
- `supabase-c2-rls-lockdown.sql` — revokes anon access and re-grants to
  verified guards / managers. **Run last, after deploy.**

---

## Deploy order (do NOT reorder — step 4 breaks the app if done early)

1. **Enable Anonymous sign-ins** — Supabase → Authentication → Providers →
   turn on *Anonymous sign-ins*.
2. **Run `supabase-c2-guard-auth.sql`** in the SQL Editor. Nothing breaks yet.
3. **Merge & deploy this PR** (Vercel). Then **verify on the live site**:
   - Guard login dropdown populates, a correct PIN logs in.
   - Start a shift, check a visitor **in** and **out**.
   - `/admin` still loads for your manager account.
4. **Confirm the manager role** exists (see the bootstrap SQL at the top of
   `supabase-c2-rls-lockdown.sql`), then **run
   `supabase-c2-rls-lockdown.sql`**.
5. **Verify the hole is closed** — in the SQL Editor:
   ```sql
   set role anon;
   select * from public.hotel_security_logs limit 1;  -- expect: 0 rows / permission denied
   reset role;
   ```
   And in a browser console on the live site:
   ```js
   await supabase.from('hotel_security_logs').select('*')  // before login: no PII
   ```

## Rollback
Re-open the tables to anon using the ROLLBACK block at the bottom of
`supabase-c2-rls-lockdown.sql`, and redeploy the previous app build if needed.

## Known follow-ups (not in this PR)
- **C1.5** — rate-limit / lock out repeated `bind_guard_session` attempts
  (online PIN guessing).
- **C3** — the overstay lock and pass locks are still enforced only in the UI;
  moving them server-side is a separate change.
