import { Shield, Lock, KeyRound, CheckCircle2, AlertTriangle, Smartphone, Download, Fingerprint } from 'lucide-react';

/*
  NFC Tag Security Guide  —  /nfc-guide
  A plain-language, team-facing page: why the visitor tags are already safe,
  and how to lock / password-protect them so nobody can tamper with them.
*/

const CARD = 'bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40';

function Step({ n, children }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-[11px] font-bold text-indigo-300">{n}</span>
      <span className="text-sm leading-relaxed text-slate-300">{children}</span>
    </li>
  );
}

export default function NfcGuidePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[420px] w-[420px] rounded-full bg-indigo-600/10 blur-[90px]" />
      <div className="relative mx-auto w-full max-w-2xl px-4 py-8 pb-20">

        {/* Header */}
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-900/40">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Security Guide</p>
            <h1 className="text-xl font-bold">Securing Visitor NFC Tags</h1>
          </div>
        </div>

        {/* Reassurance */}
        <div className={`${CARD} p-6`}>
          <div className="mb-3 flex items-center gap-2 text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="text-base font-bold">Your tags are already safe by design</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-300">
            The app identifies a tag by its <b>serial number</b> — a fixed ID built into the chip
            that <b>cannot be changed</b>. It never uses whatever is written on the tag. So even if a
            visitor rewrites the tag, it does not fool the system.
          </p>
          <ul className="mt-4 space-y-3">
            <li className="flex gap-3">
              <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
              <span className="text-sm text-slate-300"><b className="text-white">Identity is fixed.</b> The serial number is factory-locked and read-only on standard tags.</span>
            </li>
            <li className="flex gap-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
              <span className="text-sm text-slate-300"><b className="text-white">Login required.</b> Only a signed-in guard or manager can check a visitor in or out. A tag on any other phone does nothing.</span>
            </li>
            <li className="flex gap-3">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
              <span className="text-sm text-slate-300"><b className="text-white">One pass at a time.</b> The system blocks a pass from being issued to two people at once.</span>
            </li>
          </ul>
        </div>

        {/* Why still lock */}
        <div className={`${CARD} mt-5 p-6`}>
          <div className="mb-2 flex items-center gap-2 text-amber-300">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-base font-bold">The one thing worth doing</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-300">
            A visitor still can't harm the system, but for fun they could write junk into the tag's
            data (which the app ignores) — for example putting back an old link that pops up when the
            tag is tapped. To stop that completely, <b>lock or password-protect each tag once</b>,
            using the free <b>NFC Tools</b> app on an Android phone.
          </p>
        </div>

        {/* Install */}
        <div className={`${CARD} mt-5 p-6`}>
          <div className="mb-3 flex items-center gap-2 text-slate-200">
            <Download className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-bold">Step 0 — Install the tool</h2>
          </div>
          <ol className="space-y-3">
            <Step n="1">On an <b>Android phone</b>, open the <b>Play Store</b>.</Step>
            <Step n="2">Search for <b>“NFC Tools”</b> (by wakdev) and install it — it's free.</Step>
            <Step n="3">Turn on <b>NFC</b> in the phone's settings.</Step>
          </ol>
        </div>

        {/* Option A: Password */}
        <div className={`${CARD} mt-5 p-6`}>
          <div className="mb-2 flex items-center gap-2 text-emerald-300">
            <KeyRound className="h-5 w-5" />
            <h2 className="text-base font-bold">Option A — Password-protect (recommended)</h2>
          </div>
          <p className="mb-4 text-sm text-slate-400">
            Stops anyone rewriting the tag unless they know the password. <b className="text-emerald-300">Reversible</b> —
            you can remove or change it later. This is the safe choice.
          </p>
          <ol className="space-y-3">
            <Step n="1">Open <b>NFC Tools</b> → go to the <b>Other</b> tab.</Step>
            <Step n="2">Tap <b>“Set password”</b> (or “Password protection”).</Step>
            <Step n="3">Type a password your team will remember, and confirm.</Step>
            <Step n="4">Hold the tag to the back of the phone until you see <b>“Write complete”</b>.</Step>
            <Step n="5">Repeat for each tag. To change or remove it later: <b>Other → Remove password</b> (needs the current password).</Step>
          </ol>
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-200/90">
            Keep the password written down somewhere only managers can see — you'll need it to edit or unlock a tag.
          </div>
        </div>

        {/* Option B: Lock */}
        <div className={`${CARD} mt-5 p-6`}>
          <div className="mb-2 flex items-center gap-2 text-slate-200">
            <Lock className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-bold">Option B — Lock read-only (permanent)</h2>
          </div>
          <p className="mb-4 text-sm text-slate-400">
            Makes the tag impossible to rewrite by anyone, ever. Simplest, but <b className="text-amber-300">cannot be undone</b> —
            only do this on tags you've finished with.
          </p>
          <ol className="space-y-3">
            <Step n="1">Open <b>NFC Tools</b> → <b>Other</b> tab.</Step>
            <Step n="2">Tap <b>“Make read-only”</b> (or “Lock tag”).</Step>
            <Step n="3">Confirm, then hold the tag to the phone until it says <b>“Locked”</b>.</Step>
          </ol>
          <div className="mt-4 flex gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/90">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Once a tag is locked read-only, you can never change its data again — the serial number still works with the app, but the tag can't be re-used for anything else. Prefer <b>Option A</b> if unsure.</span>
          </div>
        </div>

        {/* When crypto */}
        <div className={`${CARD} mt-5 p-6`}>
          <div className="mb-2 flex items-center gap-2 text-slate-200">
            <Fingerprint className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-bold">For high-security needs (later)</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-300">
            Locking stops tampering, but a determined person with special hardware could still copy a
            tag's serial number. For visitor passes this is very low risk, and the one-pass-at-a-time
            rule limits any impact. If you ever need copy-proof tags — most relevant for the future
            <b> keys &amp; safe-box</b> module — use <b>cryptographic tags (NTAG&nbsp;424&nbsp;DNA)</b>, which
            produce a signed code on every tap that the system verifies, so a copy can't fake it.
          </p>
        </div>

        {/* Footer note */}
        <div className="mt-6 flex items-start gap-2 px-1 text-xs text-slate-500">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
          <p>All steps use an Android phone with NFC. Menu names in NFC Tools may vary slightly by version, but the options live under the <b>Other</b> tab.</p>
        </div>

      </div>
    </div>
  );
}
