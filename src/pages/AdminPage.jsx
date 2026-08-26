import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx-js-style';
import { supabase } from '../supabaseClient';
import { hashPin } from '../lib/crypto';
import { generateProfessionalExcelReport, writeWorkbookWithFrozenHeaders } from '../utils/excelExporter';
import { parseLogDetails, escapeSpreadsheetValue } from '../utils/logFormatter';
import {
  Shield, Users, Tag, FileText, AlertTriangle, LogOut,
  Plus, Trash2, Eye, EyeOff, RefreshCw, Download, Wifi,
  CheckCircle, CheckCircle2, XCircle, Clock, Loader2, ChevronDown, Search,
  BarChart2, Phone, Edit2, Save, X, Key, Smartphone, Unlock, ClipboardList,
} from 'lucide-react';

/* ── Design tokens (violet/purple accent for admin) ─────── */
const CARD  = 'bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40';
const INPUT = 'w-full bg-slate-950/70 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60 focus:border-violet-500/60 transition';
const LABEL = 'block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5';
const BTN_PRI = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-900/40 disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SEC = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 font-medium text-slate-300 hover:bg-white/10 hover:text-white transition disabled:opacity-40';
const BTN_RED = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-900/40 disabled:opacity-50';

const TABS = [
  { id: 'dashboard', label: 'Dashboard',  icon: BarChart2 },
  { id: 'staff',     label: 'Staff',      icon: Users     },
  { id: 'passes',    label: 'Passes',     icon: Tag       },
  { id: 'logs',      label: 'Logs',       icon: FileText  },
  { id: 'handovers', label: 'Handovers',  icon: ClipboardList },
];

const TRAFFIC_LABELS = {
  supplier_delivery:    'Supplier',
  contractor_engineer:  'Contractor',
  casual_staff_banquet: 'Casual',
  hotel_guest_visitor:  'Visitor',
};

function fmtDate(d) { return d ? new Date(d).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'; }
function fmtDur(i, o) {
  if (!i || !o) return '—';
  const m = Math.round((new Date(o) - new Date(i)) / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;
}

/* ── 6-dot mini PIN input ── */
function MiniPinInput({ value, onChange, placeholder = 'Enter 6-digit PIN' }) {
  return (
    <input
      type="password"
      inputMode="numeric"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      placeholder={placeholder}
      className={INPUT}
    />
  );
}

/* ══════════════════════════════════════════════════════════════
   MANAGER AUTH
══════════════════════════════════════════════════════════════ */
function ManagerAuth({ onAuth, notify }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return notify(error.message, 'error');
    onAuth(data.session);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-purple-600/10 blur-[100px]" />
      <div className={`relative w-full max-w-sm p-8 ${CARD}`}>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-xl shadow-violet-900/50">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Manager Portal</h1>
          <p className="mt-1 text-sm text-slate-400">Hotel Security Administration</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className={LABEL}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@hotel.com" required className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                className={`${INPUT} pr-10`} />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white transition">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={busy} className={`${BTN_PRI} w-full py-3 text-sm`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Sign In to Manager Portal
          </button>
        </form>
        <div className="mt-6 border-t border-white/5 pt-4 text-center">
          <a href="/" className="text-xs text-slate-500 hover:text-violet-400 transition-colors">← Guard Terminal</a>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════════ */
function Dashboard({ notify }) {
  const [stats, setStats] = useState({ inside: 0, overstay: 0, today: 0, month: 0 });
  const [breakdown, setBreakdown] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: all } = await supabase.from('hotel_security_logs').select('*').order('check_in_time', { ascending: false });
    const rows = all || [];

    const inside   = rows.filter((r) => r.status === 'inside');
    const overstay = inside.filter((r) => (Date.now() - new Date(r.check_in_time)) / 3600000 > (r.allowed_hours || 2));
    const todayRows = rows.filter((r) => r.check_in_time >= todayStart);
    const monthRows = rows.filter((r) => r.check_in_time >= monthStart);

    setStats({ inside: inside.length, overstay: overstay.length, today: todayRows.length, month: monthRows.length });
    setRecent(rows.slice(0, 8));

    // Traffic breakdown (today)
    const counts = {};
    todayRows.forEach((r) => { counts[r.traffic_type] = (counts[r.traffic_type] || 0) + 1; });
    const total = todayRows.length || 1;
    setBreakdown(Object.entries(counts).map(([k, v]) => ({
      label: TRAFFIC_LABELS[k] || k, count: v, pct: Math.round((v / total) * 100),
    })).sort((a, b) => b.count - a.count));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const STAT_CARDS = [
    { label: 'Inside Now',      value: stats.inside,   color: 'from-blue-600 to-cyan-600',    text: 'text-blue-400'    },
    { label: 'Overstay Alerts', value: stats.overstay, color: 'from-red-600 to-rose-600',     text: 'text-red-400'     },
    { label: "Today's Check-ins",value: stats.today,   color: 'from-emerald-600 to-teal-600', text: 'text-emerald-400' },
    { label: 'This Month',      value: stats.month,    color: 'from-violet-600 to-purple-600',text: 'text-violet-400'  },
  ];

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {STAT_CARDS.map((s) => (
              <div key={s.label} className={`${CARD} p-5`}>
                <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${s.color} opacity-80`}>
                  <BarChart2 className="h-4 w-4 text-white" />
                </div>
                <p className={`text-3xl font-bold tabular-nums ${s.text}`}>{s.value}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Traffic breakdown */}
            <div className={`${CARD} p-5`}>
              <h3 className="mb-4 font-bold text-sm">Today's Traffic Breakdown</h3>
              {breakdown.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No check-ins today</p>
              ) : (
                <div className="space-y-3">
                  {breakdown.map((b) => (
                    <div key={b.label}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-300">{b.label}</span>
                        <span className="text-slate-400">{b.count} ({b.pct}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/5">
                        <div className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
                          style={{ width: `${b.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div className={`${CARD} p-5`}>
              <h3 className="mb-4 font-bold text-sm">Recent Activity</h3>
              <div className="space-y-2">
                {recent.slice(0, 6).map((r) => (
                  <div key={r.id} className="flex items-center gap-2.5 text-sm">
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${r.status === 'inside' ? 'bg-blue-400' : 'bg-slate-600'}`} />
                    <span className="flex-1 truncate text-slate-200">{r.full_name}</span>
                    <span className="font-mono text-[10px] text-violet-400">{r.pass_badge_no}</span>
                    <span className="text-[10px] text-slate-500">{new Date(r.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
                {recent.length === 0 && <p className="text-sm text-slate-500 py-2 text-center">No records yet</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STAFF MANAGER
══════════════════════════════════════════════════════════════ */
function StaffManager({ session, notify }) {
  const [guards, setGuards]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newPin,  setNewPin]  = useState('');
  const [adding,  setAdding]  = useState(false);
  const [editId,  setEditId]  = useState(null);
  const [editPin, setEditPin] = useState('');
  const [lockedNames, setLockedNames] = useState(() => new Set());

  const fetchGuards = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: locked }] = await Promise.all([
      supabase.from('guards').select('*').order('name'),
      supabase.rpc('list_locked_guards'),
    ]);
    setGuards(data || []);
    setLockedNames(new Set((locked || []).map((r) => r.guard_name)));
    setLoading(false);
  }, []);

  useEffect(() => { fetchGuards(); }, [fetchGuards]);

  const addGuard = async (e) => {
    e.preventDefault();
    if (newPin.length !== 6) return notify('PIN must be exactly 6 digits', 'error');
    setAdding(true);
    const pin_hash = await hashPin(newPin, newName);
    const { error } = await supabase.from('guards').insert([{
      name: newName.trim(), pin_hash, created_by: session.user.id,
    }]);
    setAdding(false);
    if (error) return notify(error.message, 'error');
    notify(`Guard "${newName}" created`, 'success');
    setNewName(''); setNewPin(''); fetchGuards();
  };

  const toggleActive = async (g) => {
    await supabase.from('guards').update({ is_active: !g.is_active }).eq('id', g.id);
    notify(`${g.name} ${g.is_active ? 'disabled' : 'enabled'}`, 'info'); fetchGuards();
  };

  const resetPin = async (g) => {
    if (editPin.length !== 6) return notify('New PIN must be 6 digits', 'error');
    const pin_hash = await hashPin(editPin, g.name);
    await supabase.from('guards').update({ pin_hash }).eq('id', g.id);
    notify(`PIN reset for ${g.name}`, 'success'); setEditId(null); setEditPin(''); fetchGuards();
  };

  const deleteGuard = async (g) => {
    if (!confirm(`Delete guard "${g.name}"? This cannot be undone.`)) return;
    await supabase.from('guards').delete().eq('id', g.id);
    notify(`Guard "${g.name}" deleted`, 'info'); fetchGuards();
  };

  const unlockGuard = async (g) => {
    const { data, error } = await supabase.rpc('clear_guard_lockout', { p_name: g.name });
    if (error) return notify(error.message, 'error');
    if (!data?.success) return notify(data?.error || 'Could not unlock guard', 'error');
    notify(`${g.name} unlocked — they can sign in again`, 'success');
    fetchGuards();
  };

  return (
    <div className="space-y-5">
      {/* Create guard */}
      <div className={`${CARD} p-5`}>
        <h3 className="mb-4 font-bold flex items-center gap-2"><Plus className="h-4 w-4 text-violet-400" /> Create Guard Account</h3>
        <form onSubmit={addGuard} className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL}>Full Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Guard name" required className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Set 6-Digit PIN</label>
            <MiniPinInput value={newPin} onChange={setNewPin} placeholder="e.g. 123456" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={adding || newPin.length !== 6 || !newName.trim()} className={`${BTN_PRI} w-full py-2.5 text-sm`}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create Guard
            </button>
          </div>
        </form>
      </div>

      {/* Guards list */}
      <div className={`${CARD} p-5`}>
        <h3 className="mb-4 font-bold flex items-center justify-between">
          Guard Accounts ({guards.length})
          <button onClick={fetchGuards} className="text-slate-400 hover:text-white transition"><RefreshCw className="h-4 w-4" /></button>
        </h3>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div> :
          guards.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No guard accounts yet</p> : (
          <div className="space-y-2">
            {guards.map((g) => (
              <div key={g.id} className={`rounded-xl border px-4 py-3 ${g.is_active ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02] opacity-60'}`}>
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-sm ${g.is_active ? 'bg-violet-600/30 text-violet-300' : 'bg-slate-700/50 text-slate-500'}`}>
                    {g.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-white flex items-center gap-1.5">
                      {g.name}
                      {lockedNames.has(g.name) && (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-600/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                          🔒 LOCKED
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500">Created {new Date(g.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Unlock (only when locked out by failed PIN attempts) */}
                    {lockedNames.has(g.name) && (
                      <button onClick={() => unlockGuard(g)}
                        className="rounded-lg border border-amber-500/40 bg-amber-600/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-600/20 transition flex items-center gap-1"
                        title="Locked by too many failed PIN attempts — click to unlock now">
                        <Unlock className="h-3 w-3" /> Unlock
                      </button>
                    )}
                    {/* PIN reset */}
                    {editId === g.id ? (
                      <div className="flex items-center gap-2">
                        <input type="password" inputMode="numeric" maxLength={6} value={editPin}
                          onChange={(e) => setEditPin(e.target.value.replace(/\D/g,'').slice(0,6))}
                          placeholder="New PIN" className="w-28 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs text-white" />
                        <button onClick={() => resetPin(g)} disabled={editPin.length !== 6}
                          className="rounded-lg bg-violet-600/20 border border-violet-500/30 px-2 py-1 text-xs text-violet-300 hover:bg-violet-600/30 transition">
                          <Save className="h-3 w-3" />
                        </button>
                        <button onClick={() => { setEditId(null); setEditPin(''); }}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-400 hover:text-white transition">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditId(g.id); setEditPin(''); }}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-violet-300 transition" title="Reset PIN">
                        <Key className="h-3 w-3" />
                      </button>
                    )}
                    {/* Toggle active */}
                    <button onClick={() => toggleActive(g)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${g.is_active ? 'border-red-500/30 bg-red-600/10 text-red-400 hover:bg-red-600/20' : 'border-emerald-500/30 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20'}`}>
                      {g.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => deleteGuard(g)} className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-red-400 transition">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PASS MANAGER
══════════════════════════════════════════════════════════════ */
function PassManager({ session, notify }) {
  const [passes,       setPasses]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState('all');
  const [bulkType,     setBulkType]     = useState('visitor');
  const [bulkFrom,     setBulkFrom]     = useState('1');
  const [bulkTo,       setBulkTo]       = useState('20');
  const [creating,     setCreating]     = useState(false);
  const [nfcPassId,    setNfcPassId]    = useState(null);
  const [nfcActive,    setNfcActive]    = useState(false);

  const PREFIX = { visitor: 'V', contractor: 'C', supplier: 'S' };

  const fetchPasses = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('passes').select('*').order('pass_number');
    setPasses(data || []); setLoading(false);
  }, []);

  useEffect(() => { fetchPasses(); }, [fetchPasses]);

  const bulkCreate = async (e) => {
    e.preventDefault();
    const from = parseInt(bulkFrom, 10); const to = parseInt(bulkTo, 10);
    if (isNaN(from) || isNaN(to) || from > to) return notify('Invalid range', 'error');
    if (to - from > 200) return notify('Max 200 passes at once', 'error');
    setCreating(true);
    const prefix = PREFIX[bulkType];
    const rows = [];
    for (let n = from; n <= to; n++) {
      rows.push({ pass_number: `${prefix}-${String(n).padStart(3,'0')}`, pass_type: bulkType, created_by: session.user.id });
    }
    const { error } = await supabase.from('passes').upsert(rows, { onConflict: 'pass_number', ignoreDuplicates: true });
    setCreating(false);
    if (error) return notify(error.message, 'error');
    notify(`Created ${rows.length} passes (${prefix}-${String(from).padStart(3,'0')} to ${prefix}-${String(to).padStart(3,'0')})`, 'success');
    fetchPasses();
  };

  const deactivate = async (p) => {
    await supabase.from('passes').update({ status: p.status === 'inactive' ? 'available' : 'inactive' }).eq('id', p.id);
    fetchPasses();
  };

  const deletePass = async (p) => {
    if (p.status === 'in_use') return notify('Cannot delete a pass that is in use', 'error');
    if (!confirm(`Delete ${p.pass_number}?`)) return;
    await supabase.from('passes').delete().eq('id', p.id);
    notify(`Pass ${p.pass_number} deleted`, 'info'); fetchPasses();
  };

  const assignNfc = async (passId) => {
    if (!('NDEFReader' in window)) {
      return notify('NFC not supported on this device. Use Android Chrome.', 'info');
    }
    try {
      const ndef = new window.NDEFReader();
      await ndef.scan();
      setNfcPassId(passId); setNfcActive(true);
      notify('Hold the NFC badge to the back of this phone…', 'info');
      ndef.onreading = async ({ serialNumber }) => {
        const uid = serialNumber.replace(/:/g, '').toUpperCase();
        await supabase.from('passes').update({ nfc_uid: uid }).eq('id', passId);
        notify(`NFC UID ${uid} linked to pass`, 'success');
        setNfcPassId(null); setNfcActive(false); fetchPasses();
      };
    } catch (e) {
      setNfcPassId(null); setNfcActive(false); notify('NFC error: ' + e.message, 'error');
    }
  };

  const filtered = passes.filter((p) => filter === 'all' || p.status === filter || (filter === 'visitor' && p.pass_type === 'visitor') || (filter === 'contractor' && p.pass_type === 'contractor') || (filter === 'supplier' && p.pass_type === 'supplier'));

  const statusColor = { available: 'bg-emerald-500', in_use: 'bg-blue-500', inactive: 'bg-slate-600' };

  return (
    <div className="space-y-5">
      {/* Bulk create */}
      <div className={`${CARD} p-5`}>
        <h3 className="mb-4 font-bold flex items-center gap-2"><Plus className="h-4 w-4 text-violet-400" /> Bulk Create Passes</h3>
        <form onSubmit={bulkCreate} className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className={LABEL}>Pass Type</label>
            <select value={bulkType} onChange={(e) => setBulkType(e.target.value)} className={INPUT + ' appearance-none'}>
              <option value="visitor">Visitor (V-xxx)</option>
              <option value="contractor">Contractor (C-xxx)</option>
              <option value="supplier">Supplier (S-xxx)</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>From #</label>
            <input type="number" min="1" value={bulkFrom} onChange={(e) => setBulkFrom(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>To #</label>
            <input type="number" min="1" value={bulkTo} onChange={(e) => setBulkTo(e.target.value)} className={INPUT} />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={creating} className={`${BTN_PRI} w-full py-2.5 text-sm`}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create
            </button>
          </div>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Example: Visitor, 1–50 creates <span className="font-mono text-violet-400">V-001</span> through <span className="font-mono text-violet-400">V-050</span>. Duplicates are skipped.
        </p>
      </div>

      {/* Pass list */}
      <div className={`${CARD} p-5`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">Pass Pool ({passes.length} total)</h3>
          <div className="flex flex-wrap gap-1.5">
            {['all','available','in_use','inactive','visitor','contractor','supplier'].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${filter === f ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div> :
          filtered.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No passes found</p> : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => (
              <div key={p.id} className={`rounded-xl border p-3 ${p.status === 'in_use' ? 'border-blue-500/30 bg-blue-950/30' : p.status === 'inactive' ? 'border-white/5 bg-white/[0.02] opacity-50' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm font-bold text-white">{p.pass_number}</span>
                  <span className={`h-2 w-2 rounded-full ${statusColor[p.status] || 'bg-slate-600'}`} />
                </div>
                <p className="text-[10px] text-slate-400 capitalize">{p.status.replace('_',' ')}</p>
                {p.nfc_uid && <p className="text-[9px] text-violet-400 font-mono mt-0.5 truncate">{p.nfc_uid}</p>}
                <div className="mt-2 flex gap-1.5">
                  <button onClick={() => assignNfc(p.id)}
                    className={`flex-1 rounded-lg border px-1.5 py-1 text-[10px] transition ${nfcPassId === p.id && nfcActive ? 'border-violet-500/60 bg-violet-600/20 text-violet-300 animate-pulse' : 'border-white/10 bg-white/5 text-slate-400 hover:text-violet-300'}`}
                    title="Assign NFC">
                    <Wifi className="mx-auto h-3 w-3" />
                  </button>
                  <button onClick={() => deactivate(p)} className="flex-1 rounded-lg border border-white/10 bg-white/5 px-1.5 py-1 text-[10px] text-slate-400 hover:text-amber-300 transition" title="Toggle active">
                    {p.status === 'inactive' ? <CheckCircle className="mx-auto h-3 w-3" /> : <XCircle className="mx-auto h-3 w-3" />}
                  </button>
                  <button onClick={() => deletePass(p)} className="flex-1 rounded-lg border border-white/5 bg-white/5 px-1.5 py-1 text-[10px] text-slate-500 hover:text-red-400 transition">
                    <Trash2 className="mx-auto h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LOG TABLE
══════════════════════════════════════════════════════════════ */
function LogTable({ notify }) {
  const [logs,           setLogs]           = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState('');
  const [status,         setStatus]         = useState('all');
  const [ttype,          setTtype]          = useState('all');
  const [timeRange,      setTimeRange]      = useState('24h');
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');
  const [currentTime,    setCurrentTime]    = useState(Date.now());

  /* ── Manager Extend Time Modal ── */
  const [extendModalLog, setExtendModalLog] = useState(null);
  const [extraHours,     setExtraHours]     = useState(2);
  const [extendReason,   setExtendReason]   = useState('');
  const [extendApprover, setExtendApprover] = useState('');
  const [extending,      setExtending]      = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('hotel_security_logs').select('*').order('check_in_time', { ascending: false }).limit(500);
    if (status === 'overstay') q = q.eq('status', 'inside'); // overstayers are still inside
    else if (status !== 'all') q = q.eq('status', status);
    if (ttype !== 'all')  q = q.eq('traffic_type', ttype);

    if (timeRange === '12h' && !dateFrom && !dateTo) {
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      q = q.or(`check_in_time.gte.${twelveHoursAgo},status.eq.inside`);
    } else if (timeRange === '24h' && !dateFrom && !dateTo) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      q = q.or(`check_in_time.gte.${twentyFourHoursAgo},status.eq.inside`);
    }

    if (dateFrom) q = q.gte('check_in_time', dateFrom);
    if (dateTo)   q = q.lte('check_in_time', dateTo + 'T23:59:59');
    const { data } = await q;
    setLogs(data || []); setLoading(false);
  }, [status, ttype, timeRange, dateFrom, dateTo]);

  // Keep the latest fetchLogs in a ref so the realtime subscription (mounted
  // once) always refetches using the current filters.
  const fetchLogsRef = useRef(fetchLogs);
  useEffect(() => { fetchLogsRef.current = fetchLogs; }, [fetchLogs]);

  // Fetch on mount and whenever a filter changes.
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Realtime: refetch ONLY when the table actually changes (check-in, check-out,
  // extension) — one websocket instead of a query every 10 seconds.
  useEffect(() => {
    const channel = supabase.channel('admin-logs-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hotel_security_logs' },
        () => fetchLogsRef.current())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // Client-only clock (no API) so the overstay colour advances between events.
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Overstay state for a row: past the allowed (or extended) time. A 15-minute
  // grace window shows amber; beyond that it turns hard red.
  const overstayInfo = (l) => {
    const allowedH = Number(l.allowed_hours) > 0 ? Number(l.allowed_hours) : 2;
    const elapsedH = l.status === 'inside'
      ? (currentTime - new Date(l.check_in_time).getTime()) / 3600000 : 0;
    return {
      allowedH,
      elapsedH,
      isOver:    l.status === 'inside' && elapsedH > allowedH,
      isOverRed: l.status === 'inside' && elapsedH > allowedH + 0.25,
    };
  };

  const displayed = logs.filter((l) => {
    const matchesSearch = !search || [l.full_name, l.doc_number, l.pass_badge_no, l.company_name, l.mobile_number]
      .some((f) => f?.toLowerCase().includes(search.toLowerCase()));
    if (!matchesSearch) return false;
    if (status === 'overstay') return overstayInfo(l).isOver;
    return true;
  });

  const handleExtendStay = async (e) => {
    e.preventDefault();
    if (!extendModalLog) return;
    if (!extendReason.trim()) return notify('Reason for extension is required', 'error');
    if (!extendApprover.trim()) return notify('Approving manager / contact name is required', 'error');
    const addH = Number(extraHours) || 1;
    if (addH <= 0) return notify('Extension hours must be greater than 0', 'error');

    setExtending(true);
    // Extension is recorded server-side (extensions table) and raises
    // allowed_hours atomically via grant_extension (manager-gated).
    const { data: result, error } = await supabase.rpc('grant_extension', {
      p_log_id:   extendModalLog.id,
      p_hours:    addH,
      p_reason:   extendReason.trim(),
      p_approver: extendApprover.trim(),
    });
    setExtending(false);
    if (error) return notify('Failed to extend time: ' + error.message, 'error');
    if (!result?.success) return notify(result?.error || 'Failed to extend time', 'error');

    notify(`✅ Extended ${extendModalLog.full_name} by +${addH}h (Total allowed: ${result.new_allowed_hours}h)`, 'success');
    setExtendModalLog(null);
    fetchLogs();
  };

  // Manager-only: close a stuck / overstayed 'inside' record (person left but
  // was never checked out) and free its pass. Enforced by manager_force_checkout.
  const handleForceCheckout = async (l) => {
    const reason = window.prompt(
      `Force check-out "${l.full_name}"?\nThis closes the record and frees pass ${l.pass_badge_no || 'CASUAL'}.\n\nReason (e.g. "left without checkout", "stale/duplicate entry"):`,
      '',
    );
    if (reason === null) return; // cancelled
    const { data: result, error } = await supabase.rpc('manager_force_checkout', {
      p_log_id: l.id, p_reason: reason.trim(),
    });
    if (error) return notify(error.message, 'error');
    if (!result?.success) return notify(result?.error || 'Force check-out failed', 'error');
    notify(`✅ ${l.full_name} force-checked-out — pass freed`, 'success');
    fetchLogs();
  };

  const exportExcel = () => {
    generateProfessionalExcelReport(displayed, notify);
  };

  const STATUS_BADGE = {
    inside:       'bg-blue-600/20 text-blue-300 border-blue-500/30',
    checked_out:  'bg-slate-700/40 text-slate-400 border-slate-600/30',
  };

  return (
    <div className={`${CARD} p-5`}>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, doc, pass, company…"
            className={`${INPUT} pl-9`} />
        </div>
        <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className={`${INPUT} w-auto text-xs py-2 appearance-none font-semibold text-violet-300`}>
          <option value="24h">🕒 Last 24 Hours (Active Window)</option>
          <option value="12h">🕒 Last 12 Hours</option>
          <option value="all">📅 All Time / Custom Dates</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${INPUT} w-36 appearance-none`}>
          <option value="all">All Status</option>
          <option value="inside">Inside</option>
          <option value="checked_out">Checked Out</option>
          <option value="overstay">⚠️ Overstay</option>
        </select>
        <select value={ttype} onChange={(e) => setTtype(e.target.value)} className={`${INPUT} w-36 appearance-none`}>
          <option value="all">All Types</option>
          <option value="supplier_delivery">Supplier</option>
          <option value="contractor_engineer">Contractor</option>
          <option value="casual_staff_banquet">Casual</option>
          <option value="hotel_guest_visitor">Visitor</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${INPUT} w-36`} />
        <input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   className={`${INPUT} w-36`} />
        <button onClick={exportExcel} className={`${BTN_PRI} px-4 py-2.5 text-sm`}>
          <Download className="h-4 w-4" /> Export Excel
        </button>
      </div>

      <p className="mb-3 text-xs text-slate-400">{displayed.length} records</p>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div> : (
        <div className="overflow-x-auto -mx-2">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Pass #','Name','Type','Company','Department','Check-In','Check-Out','Duration','Status','Action'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((l) => {
                const info = parseLogDetails(l);
                const over = overstayInfo(l);

                return (
                <tr key={l.id} className={`border-b transition ${
                  over.isOverRed
                    ? 'border-red-500/40 bg-red-950/30 hover:bg-red-900/30'
                    : over.isOver
                    ? 'border-amber-500/40 bg-amber-950/20 hover:bg-amber-900/20'
                    : info.isExtended
                    ? 'border-cyan-500/30 bg-cyan-950/20 hover:bg-cyan-900/30'
                    : 'border-white/5 hover:bg-white/5'
                }`}>
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-violet-300">
                    {l.pass_badge_no || 'CASUAL'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-white max-w-40 truncate">{l.full_name}</div>
                    {l.nationality && <span className="text-[10px] text-slate-400">{l.nationality} • </span>}
                    <span className="text-[10px] text-slate-400 font-mono">{l.doc_number || ''}</span>

                    {/* Extension note under visitor */}
                    {info.isExtended && (
                      <div className="mt-1 flex items-start gap-1 rounded bg-cyan-950/60 border border-cyan-500/40 px-1.5 py-0.5 text-[9px] text-cyan-200">
                        <Clock className="h-2.5 w-2.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-bold text-cyan-300">{info.extHours ? `+${info.extHours}h ` : ''}Ext: </span>
                          <span>{info.extReason || 'Manager Approval'} </span>
                          {info.extApprover && <span className="text-cyan-400">({info.extApprover})</span>}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs">
                    <div className="font-medium text-slate-200">{TRAFFIC_LABELS[l.traffic_type]||l.traffic_type}</div>
                    {/* Contractor Kind / Visitor Purpose */}
                    {info.workKind ? (
                      <div className="text-[10px] text-amber-300 mt-0.5">🔨 {info.workKind} {info.workPermit ? `(PTW: ${info.workPermit})` : ''}</div>
                    ) : (
                      <div className="text-[10px] text-slate-400 mt-0.5">{info.cleanPurpose}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs max-w-36">
                    <div className="text-white font-medium truncate">{l.company_name || '—'}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{l.vehicle_plate || 'Walk-in'}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-300">
                    <div className="font-medium text-white">{info.department}</div>
                    {info.visitingPerson && (
                      <div className="text-[10px] text-indigo-300 font-medium">👤 Host: {info.visitingPerson}</div>
                    )}
                    {info.workArea && (
                      <div className="text-[10px] text-amber-300">📍 Area: {info.workArea}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-300 whitespace-nowrap">
                    <div>{fmtDate(l.check_in_time)}</div>
                    <div className="text-[9px] text-slate-500">{l.logged_by_guard || '—'}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-300 whitespace-nowrap">
                    <div>{fmtDate(l.check_out_time)}</div>
                    <div className="text-[9px] text-slate-500">{l.checkout_by_guard || '—'}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-400 font-mono">{fmtDur(l.check_in_time,l.check_out_time)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[l.status]||'bg-slate-700/40 text-slate-400 border-slate-600/30'}`}>
                      {l.status.replace('_',' ')}
                    </span>
                    {over.isOverRed ? (
                      <span className="mt-0.5 block text-[8px] font-extrabold text-red-300 animate-pulse">
                        ⚠️ OVERSTAY {over.elapsedH.toFixed(1)}h / {over.allowedH}h
                      </span>
                    ) : over.isOver ? (
                      <span className="mt-0.5 block text-[8px] font-bold text-amber-300">
                        ⏱️ Over (grace) {over.elapsedH.toFixed(1)}h / {over.allowedH}h
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {l.status === 'inside' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setExtendModalLog(l);
                            setExtraHours(2);
                            setExtendReason('');
                            setExtendApprover('');
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600/20 border border-indigo-500/40 px-2 py-1 text-[11px] font-bold text-indigo-300 hover:bg-indigo-600/30 transition shadow-sm"
                          title="Extend allowed stay/shift time"
                        >
                          <Clock className="h-3 w-3" /> + Extend
                        </button>
                        <button
                          type="button"
                          onClick={() => handleForceCheckout(l)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600/20 border border-red-500/40 px-2 py-1 text-[11px] font-bold text-red-300 hover:bg-red-600/30 transition shadow-sm"
                          title="Force check-out (manager): close a stale/overstayed record and free the pass"
                        >
                          <LogOut className="h-3 w-3" /> Force Out
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ); })}
              {displayed.length === 0 && (
                <tr><td colSpan={10} className="py-10 text-center text-sm text-slate-500">No records found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {/* ── Manager Extend Time Modal ── */}
      {extendModalLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 ${CARD}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/30 text-indigo-300">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Manager Override: Extend Time</h3>
                  <p className="text-xs text-slate-400">{extendModalLog.full_name} ({extendModalLog.pass_badge_no})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExtendModalLog(null)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleExtendStay} className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-1 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Department / Destination:</span>
                  <span className="font-semibold text-white">{extendModalLog.host_room_or_dept || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Allowed Duration:</span>
                  <span className="font-semibold text-white">{extendModalLog.allowed_hours || 2} hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Elapsed Time Inside:</span>
                  <span className="font-semibold text-amber-300">{fmtDur(extendModalLog.check_in_time, new Date().toISOString())}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={LABEL}>Additional Hours to Add</label>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                    New Total: {(Number(extendModalLog.allowed_hours) || 2) + (Number(extraHours) || 0)} hrs
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[1, 2, 3, 4, 8].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setExtraHours(h)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        extraHours === h
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-900/40'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      +{h} hr{h > 1 ? 's' : ''}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs text-slate-400">Custom:</span>
                    <input
                      type="number"
                      min="0.001"
                      max="72"
                      step="any"
                      placeholder="0.1"
                      value={extraHours}
                      onChange={(e) => setExtraHours(e.target.value)}
                      className="w-20 bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-400">hrs</span>
                  </div>
                </div>
              </div>

              <div>
                <label className={LABEL}>
                  Reason for Extension <span className="text-red-400">*</span>
                </label>
                <input
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="e.g. Banquet event overtime / Compressor repair continuation"
                  className={INPUT}
                  required
                />
              </div>

              <div>
                <label className={LABEL}>
                  Approved By (Department Manager / Contact) <span className="text-red-400">*</span>
                </label>
                <input
                  value={extendApprover}
                  onChange={(e) => setExtendApprover(e.target.value)}
                  placeholder="e.g. Chef Marco (F&B Director) / Mr. John (Engineering Mgr)"
                  className={INPUT}
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExtendModalLog(null)}
                  className={`${BTN_SEC} flex-1 py-2.5 text-sm`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={extending || !extendReason.trim() || !extendApprover.trim()}
                  className={`${BTN_PRI} flex-1 py-2.5 text-sm`}
                >
                  {extending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Confirm Manager Extension (+{extraHours}h)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EMERGENCY MODAL
══════════════════════════════════════════════════════════════ */
function HandoverLog({ notify }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('guard_shifts')
      .select('*')
      .eq('status', 'completed')
      .order('end_time', { ascending: false })
      .limit(100);
    setLoading(false);
    if (error) { notify(error.message, 'error'); return; }
    setShifts(data || []);
  }, [notify]);

  useEffect(() => { fetchShifts(); }, [fetchShifts]);

  const noted   = shifts.filter((s) => (s.handover_notes || '').trim()).length;
  const noNote  = shifts.length - noted;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Shift Handovers</h2>
          <p className="text-xs text-slate-400">
            Record of completed shifts and whether each officer left a proper handover note.
          </p>
        </div>
        <button onClick={fetchShifts} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {!loading && shifts.length > 0 && (
        <div className="flex gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> {noted} handed over with note
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" /> {noNote} left no note
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading handovers…
        </div>
      ) : shifts.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
          No completed shifts yet.
        </div>
      ) : (
        <div className="space-y-2">
          {shifts.map((s) => {
            const hasNote = (s.handover_notes || '').trim().length > 0;
            return (
              <div key={s.id} className={`rounded-xl border p-3.5 ${hasNote ? 'border-white/10 bg-white/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{s.guard_name || '—'}</span>
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">{s.gate_location || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Ended {fmtDate(s.end_time)}</span>
                    {hasNote ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Noted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                        <AlertTriangle className="h-3 w-3" /> No note
                      </span>
                    )}
                  </div>
                </div>
                {hasNote && (
                  <p className="mt-2 whitespace-pre-wrap border-t border-white/5 pt-2 text-sm leading-snug text-slate-200">
                    {s.handover_notes}
                  </p>
                )}
                {hasNote && (
                  s.acknowledged_by ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Accepted by {s.acknowledged_by}{s.acknowledged_at ? ` · ${fmtDate(s.acknowledged_at)}` : ''}
                    </p>
                  ) : (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5" /> Not yet acknowledged by the next shift
                    </p>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmergencyModal({ onClose, notify }) {
  const [insideLogs, setInsideLogs] = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    supabase.from('hotel_security_logs').select('*').eq('status','inside').order('host_room_or_dept')
      .then(({ data }) => { setInsideLogs(data || []); setLoading(false); });
  }, []);

  // Group by department
  const byDept = insideLogs.reduce((acc, l) => {
    const d = l.host_room_or_dept || 'General';
    acc[d] = acc[d] || [];
    acc[d].push(l);
    return acc;
  }, {});

  const whatsappText = [
    `🚨 *HOTEL EMERGENCY — EVACUATION LIST*`,
    `📅 ${new Date().toLocaleString()} | Total Inside: *${insideLogs.length} persons*`,
    ``,
    ...Object.entries(byDept).map(([dept, people]) => [
      `📍 *${dept.toUpperCase()}* (${people.length} person${people.length > 1 ? 's' : ''})`,
      ...people.map((p) => `  • ${p.pass_badge_no} — ${p.full_name}${p.company_name ? ` (${p.company_name})` : ''}${p.mobile_number ? ` 📞 ${p.mobile_number}` : ''}`),
    ].join('\n')),
    ``,
    `_Please account for all persons above._`,
  ].join('\n');

  const shareWhatsApp = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Emergency Evacuation List', text: whatsappText });
      } catch {}
    } else {
      await navigator.clipboard.writeText(whatsappText);
      notify('Evacuation list copied to clipboard — paste into WhatsApp', 'success');
    }
  };

  const downloadExcel = async () => {
    const rows = insideLogs.map((l) => ({
      'PASS #':      l.pass_badge_no,
      'FULL NAME':   l.full_name,
      'COMPANY':     l.company_name || '',
      'MOBILE':      l.mobile_number || '',
      'NATIONALITY': l.nationality || '',
      'DEPT / DEST': l.host_room_or_dept || '',
      'CHECK-IN':    fmtDate(l.check_in_time),
      'TYPE':        TRAFFIC_LABELS[l.traffic_type] || l.traffic_type,
    }));
    const header = [
      ['🚨 HOTEL EMERGENCY EVACUATION REPORT'],
      [`Generated: ${new Date().toLocaleString()}`],
      [`TOTAL PERSONS INSIDE: ${insideLogs.length}`],
      [],
    ];
    const ws = XLSX.utils.aoa_to_sheet(header);
    const safeRows = rows.map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, val]) => [k, escapeSpreadsheetValue(val)])));
    XLSX.utils.sheet_add_json(ws, safeRows, { origin: 'A5' });
    ws['!cols'] = [10,24,20,14,14,22,18,12].map((w) => ({ wch: w }));
    // Freeze the 3 banner rows + blank + the column-header row (rows 1-5) so
    // the headers stay visible while scrolling the evacuation list.
    ws['!views'] = [{ state: 'frozen', ySplit: 5, topLeftCell: 'A6', activeCell: 'A6' }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Evacuation List');
    await writeWorkbookWithFrozenHeaders(wb, `EVACUATION-${new Date().toISOString().slice(0,16).replace('T','-')}.xlsx`);
    notify('Evacuation Excel downloaded', 'success');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className={`relative w-full max-w-xl max-h-[90vh] overflow-y-auto ${CARD} border-red-500/50`}>
        {/* Header */}
        <div className="sticky top-0 bg-red-950/95 backdrop-blur border-b border-red-500/30 px-5 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 animate-pulse">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-extrabold text-red-300 uppercase tracking-wide">🚨 Emergency Evacuation</h2>
                <p className="text-xs text-red-400">{insideLogs.length} persons inside — {new Date().toLocaleTimeString()}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-red-400 hover:text-white transition"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={shareWhatsApp} className={`${BTN_RED} flex-1 py-2.5 text-sm`}>
              📲 Share via WhatsApp
            </button>
            <button onClick={downloadExcel} className={`${BTN_PRI} flex-1 py-2.5 text-sm`}>
              <Download className="h-4 w-4" /> Download Excel
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-red-400" /></div>
          ) : insideLogs.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">No one currently inside the property.</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(byDept).map(([dept, people]) => (
                <div key={dept} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h4 className="mb-2 font-bold text-sm text-red-300 uppercase tracking-wide">
                    📍 {dept} <span className="text-slate-400 font-normal normal-case">({people.length})</span>
                  </h4>
                  <div className="space-y-1.5">
                    {people.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-xs font-bold text-violet-300">{p.pass_badge_no}</span>
                        <span className="text-white font-medium">{p.full_name}</span>
                        {p.company_name && <span className="text-slate-400 text-xs">({p.company_name})</span>}
                        {p.mobile_number && <span className="ml-auto flex items-center gap-1 text-xs text-slate-400"><Phone className="h-3 w-3" />{p.mobile_number}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ADMIN PAGE  (orchestrator)
══════════════════════════════════════════════════════════════ */
export default function AdminPage({ notify }) {
  const [session,       setSession]       = useState(null);
  const [tab,           setTab]           = useState('dashboard');
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [authLoading,   setAuthLoading]   = useState(true);
  const [isManager,     setIsManager]     = useState(null); // null = checking role

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null); setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Authorize by ROLE, not just authentication: only active managers may use
  // the portal. RLS already blocks a non-manager's writes, but the UI must not
  // be shown to them either.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    supabase.rpc('is_manager').then(({ data }) => {
      if (!cancelled) setIsManager(Boolean(data));
    });
    return () => { cancelled = true; };
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut(); setSession(null); notify('Signed out', 'info');
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!session) return <ManagerAuth onAuth={setSession} notify={notify} />;

  // Still confirming the signed-in user's role.
  if (isManager === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  // Authenticated but NOT a manager — deny access to the portal.
  if (!isManager) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white flex items-center justify-center p-4">
        <div className={`relative w-full max-w-sm p-8 text-center ${CARD}`}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 shadow-xl shadow-red-900/50">
            <AlertTriangle className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-bold">Manager Access Required</h1>
          <p className="mt-2 text-sm text-slate-400">
            This account is signed in but is not a security manager. Ask an
            existing manager to grant your account manager access.
          </p>
          <p className="mt-1 text-[11px] text-slate-500">{session.user.email}</p>
          <button onClick={handleSignOut} className={`${BTN_PRI} mt-6 w-full py-2.5 text-sm`}>
            <LogOut className="h-4 w-4" /> Sign out
          </button>
          <div className="mt-4 border-t border-white/5 pt-4">
            <a href="/" className="text-xs text-slate-500 hover:text-violet-400 transition-colors">← Guard Terminal</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-900/40">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">Manager Portal</p>
              <p className="text-[10px] text-violet-400">{session.user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEmergencyOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-600/20 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-600/30 transition animate-pulse">
              <AlertTriangle className="h-3.5 w-3.5" /> 🚨 Emergency
            </button>
            <button onClick={handleSignOut} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Tab nav */}
        <div className="mx-auto max-w-6xl flex overflow-x-auto border-t border-white/5 px-4">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
                tab === id
                  ? 'border-violet-500 text-violet-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 space-y-4">
        {tab === 'dashboard' && <Dashboard notify={notify} />}
        {tab === 'staff'     && <StaffManager session={session} notify={notify} />}
        {tab === 'passes'    && <PassManager session={session} notify={notify} />}
        {tab === 'logs'      && <LogTable notify={notify} />}
        {tab === 'handovers' && <HandoverLog notify={notify} />}
      </main>

      {emergencyOpen && <EmergencyModal onClose={() => setEmergencyOpen(false)} notify={notify} />}
    </div>
  );
}
