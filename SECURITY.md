# Security Audit — Hotel Security Terminal

This document records the findings from the security review on branch
`claude/security-audit-id-scanner-ybhcav` and the actions required to close them.

Some items were **fixed in code** in this branch. Others require **manual action**
in your Supabase / Google Cloud dashboards because they involve live secrets and
policies that cannot be changed from the repository.

---

## Fixed in this branch (code)

### 1. ID scanner never returned data (functional + data-handling bug)
The camera scan always failed silently. Three defects in the frontend↔edge-function
contract:
- The frontend sent `{ image }` but the edge function read `{ imageBase64 }`, so every
  request returned HTTP 400 and the UI showed "Secure OCR unavailable".
- The frontend read `data.docNumber` / `data.fullName`, but the function returned the
  data nested under `data.extracted`.
- The edge function computed the passport MRZ regex and **threw the result away**, and
  never extracted name / nationality / expiry / document type. The Emirates-ID
  fallback regex (`784\d{15}`) also matched 18 digits instead of 15.

Fixed by rewriting `supabase/functions/scan-id/index.ts` (full Emirates ID + passport
TD3 MRZ parsing, expiry detection, `DOCUMENT_TEXT_DETECTION`) and updating
`scanFrameWithApi` in `src/App.jsx` to use the matching request/response shape.

### 2. `.env` with Supabase credentials was committed to the repo
`.env` (containing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) was tracked in git.
It has been removed from tracking, `.gitignore` now excludes `.env` / `.env.*`, and a
safe `.env.example` template was added.

> The anon key is embedded in the browser bundle so it is not a "secret" by itself —
> but committing it is still bad hygiene, and its blast radius depends entirely on RLS
> (see manual item 2 below).

### 3. Supabase CLI local state was committed
`supabase/.temp/` (project ref, pooler connection host, version pins) was tracked and is
now gitignored and untracked.

---

## Requires manual action (dashboards / secrets)

### 1. Rotate the Google Cloud Vision API key — HIGH
A Vision API key (`AIzaSy...`) was pasted into the project design document that was
shared into this chat. Treat it as compromised:
1. Google Cloud Console → APIs & Services → Credentials → **delete/rotate** that key.
2. Restrict the new key to the Cloud Vision API only, and add application restrictions.
3. Store it only on the edge function, never in the repo or the frontend:
   ```bash
   npx supabase secrets set GOOGLE_CLOUD_VISION_API_KEY=your-new-key
   ```

### 2. Lock down Row Level Security — HIGH  (auth now built-in)
The tables hold PII (Emirates ID / passport numbers, mobile numbers, nationalities).
If the RLS policies are `USING (true)` / `WITH CHECK (true)`, anyone with the public
anon key can read and write **every** row.

**Step 1 (done in code):** the app now requires a Supabase Auth login (email +
password) before the terminal loads — see `AuthScreen` in `src/App.jsx`. Guards can no
longer reach any data anonymously.

**Step 2 (you, in the dashboard):**
1. In Supabase → Authentication → Providers, keep **Email** enabled. Create guard
   accounts (Authentication → Users → Add user), or let guards self-register from the
   login screen. For a locked-down deployment, turn OFF "Enable email signups" once
   accounts exist, and turn ON "Confirm email".
2. Apply `supabase-rls-hardening.sql` (added in this branch) to restrict all access to
   the `authenticated` role. This is now safe because the app authenticates.

### 3. The `scan-id` function is deployed with `--no-verify-jwt` — MEDIUM
That makes the OCR endpoint public and unauthenticated: anyone can call it and burn your
Google Vision quota (a billing/DoS risk). Once Supabase Auth is in place, redeploy
without that flag so only signed-in callers can invoke it:
```bash
npx supabase functions deploy scan-id
```

### 4. CORS is `Access-Control-Allow-Origin: *` — LOW/MEDIUM
Combined with an unauthenticated endpoint, any website can call your function. After
auth is added, consider restricting the origin to your Vercel domain.

### In-app guard account management (managers)

Managers can add and disable guard logins from the Manager view instead of the
Supabase dashboard. Account creation uses the **service-role** key, which stays
server-side inside the `manage-guards` edge function — it is never exposed to the
browser, and every call is rejected unless the caller is an active manager.

Setup:
1. Run `supabase-manager-roles.sql` in the SQL Editor, then edit its bootstrap
   statement to set your own email as `manager`.
2. Deploy the function: `npx supabase functions deploy manage-guards`
   (the service-role key is injected automatically — no secret to set).
3. Sign in as the manager account → **Manager View → Guard Accounts** to add or
   disable guards.

### 5. Rotate the committed Supabase anon key — LOW
Because the old anon key was in git history, rotate it in Supabase → Project Settings →
API once RLS is enforced, and update the deployment env var.
