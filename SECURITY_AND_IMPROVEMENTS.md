# Hotel Security & Visitor Access — Security Hardening & Enhancement Report

**System:** Hotel Security, Visitor Access & Contractor Permitting Terminal
**Prepared for:** Client & IT Management
**Date:** 26 August 2026
**Status:** ✅ Completed and deployed to production

---

## Executive summary

A full security audit of the application was carried out, followed by a
staged remediation programme. Every issue identified — from the most critical
data-exposure risks down to minor hardening items — has been fixed, tested
against the live system, and deployed.

In addition, several operational improvements were delivered to make the
terminal faster for security officers and clearer for managers.

**Headline outcome:** the system moved from a state where anyone with the
public web key could read and alter every visitor's personal data and
impersonate a guard, to a properly authenticated system where all sensitive
data and security rules are enforced by the database and cannot be bypassed
from the browser.

---

## 1. Security posture — before vs after

| Area | Before | After |
| :--- | :--- | :--- |
| **Visitor personal data** (Emirates ID / passport / mobile) | Readable and editable by anyone with the public key | Restricted to verified guards and managers, enforced at the database |
| **Guard PIN credentials** | PIN hashes exposed; PINs recoverable offline | Hashes never exposed; brute-force locked out after repeated failures |
| **Guard sign-in** | No real session; controls advisory only | Authenticated session per device, bound to a verified PIN |
| **Overstay / pass rules** | Enforced only in the browser (bypassable) | Enforced in the database (cannot be bypassed) |
| **Manager area (`/admin`)** | Any signed-in user could open it | Restricted to accounts with the Manager role |
| **Document-scan (OCR) service** | Open to the public internet | Requires a signed-in caller; restricted to the hotel's domain |

---

## 2. Issues addressed

Severity follows a standard scale (Critical → High → Medium → Low).

| Ref | Severity | Issue | Resolution | Status |
| :-- | :-- | :-- | :-- | :-- |
| C1 | 🔴 Critical | Guard PIN hashes readable with the public key | Column-level lockdown; hashes no longer exposed | ✅ Fixed |
| C2 | 🔴 Critical | All visitor PII readable/writable with the public key | Guards authenticate; tables restricted to verified guards / managers | ✅ Fixed |
| C1.5 | 🔴 Critical | No limit on PIN guessing (online brute force) | Lockout after 5 failed attempts (15-min window) + manager unlock | ✅ Fixed |
| C3 | 🔴 Critical | Overstay lock & double-issue prevention only in the browser | Enforced in the database via secure functions & constraints | ✅ Fixed |
| H2 | 🟠 High | A pass could be issued to two people at once (race) | Database uniqueness constraint prevents it | ✅ Fixed |
| H4 | 🟠 High | Overstay "extension" could be forged in free text | Replaced with a real, manager-only extension record | ✅ Fixed |
| H3 | 🟠 High | Manager portal open to any signed-in user | Gated on the Manager role | ✅ Fixed |
| H1 | 🟠 High | OCR service was an open, unauthenticated proxy | Requires a signed-in caller; domain-restricted | ✅ Fixed |
| M1 | 🟡 Medium | Emergency evacuation Excel export crashed | Fixed (import restored) | ✅ Fixed |
| M2 | 🟡 Medium | Search field could inject database filter logic | Input sanitised | ✅ Fixed |
| L2 | 🟢 Low | Exported spreadsheets could carry formula-injection | Cell values neutralised on export | ✅ Fixed |

Additional data-integrity gap fixed alongside C3: a person already inside
could be checked in again (duplicate record), and overstayed visitors could be
left "inside" forever. The system now blocks duplicate active entries and gives
managers a **Force Check-Out** control to close stale records.

---

## 3. How access is now enforced

- **Authenticated sessions.** The guard terminal establishes a real login
  session on each device; entering a valid PIN binds that session to a
  specific security officer. Only PIN-verified sessions (and managers) can read
  or write visitor data.
- **Database-level access control (RLS).** Permissions are enforced by the
  database itself, not the web page — so the rules hold no matter how the
  system is accessed.
- **Server-enforced workflow.** Check-in, check-out, time extensions and
  force-close all run through secure database functions that apply the rules
  (overstay lock, one-pass-per-person, no duplicate entries) centrally.
- **Manager-only powers.** Granting extensions, force-closing records and
  managing guard accounts are restricted to Manager accounts.

---

## 4. Operational enhancements

- **Faster check-in for regulars.** Typing part of an ID / mobile, or scanning
  a returning visitor's document, auto-fills their saved details (name,
  company, mobile, vehicle, nationality, expiry) — including the complete ID
  number. When several people match, a quick pick-list is shown.
- **Live manager dashboard, lighter on resources.** The Manager "Logs" view now
  updates the instant something happens (check-in, check-out, extension) using
  a live connection, instead of repeatedly polling the database. This removed
  roughly 360 unnecessary database queries per hour, per open screen.
- **Overstay visibility for managers.** Overstayed visitors are highlighted
  (amber during a 15-minute grace period, then red) and can be isolated with a
  new **Overstay** filter — matching the guard terminal.
- **Interface correction.** Corrected a column-alignment issue in the manager
  log table on desktop.

---

## 5. Deployment & verification

- All changes were delivered in small, reviewed increments and **merged and
  deployed to production**.
- Each change was **verified against the live system** before moving on.
- The OCR service was redeployed to require authentication, and the
  document-scan feature was confirmed working for signed-in officers.

---

## 6. Recommended next steps (optional)

These are good-practice follow-ups, not outstanding defects:

1. **Rotate the public API key** now that database-level access control is in
   force (routine hygiene).
2. **Automated tests** around the new secure functions, to keep the protections
   in place as the app evolves.
3. **Periodic review** of guard and manager accounts.

---

*This document summarises the security review and improvement work completed on
the Hotel Security & Visitor Access system. Technical migration details are
recorded in the repository's `SECURITY.md`, `C2_MIGRATION.md` and
`C3_MIGRATION.md`.*
