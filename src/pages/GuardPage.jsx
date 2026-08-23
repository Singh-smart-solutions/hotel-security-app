import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { hashPin } from '../lib/crypto';
import * as XLSX from 'xlsx';
import {
  BrowserMultiFormatReader, BarcodeFormat, DecodeHintType,
} from '@zxing/library';
import {
  Shield, Truck, Wrench, Users, UserCheck, LogOut, AlertTriangle,
  Smartphone, Camera, X, Loader2, CheckCircle2, ScanLine,
  ChevronDown, Wifi, Tag, Clock, UserX, RefreshCw,
} from 'lucide-react';

/* ── Design tokens ─────────────────────────────────────────── */
const CARD    = 'bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40';
const INPUT   = 'w-full bg-slate-950/70 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/60 transition';
const LABEL   = 'block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5';
const BTN_PRI = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-900/40 disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SEC = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 font-medium text-slate-300 hover:bg-white/10 hover:text-white transition disabled:opacity-40';

/* ── Traffic types ─────────────────────────────────────────── */
const TRAFFIC_TYPES = [
  { id: 'supplier_delivery',   label: 'Supplier / Truck',  icon: Truck,      hours: 0.75, passType: 'supplier',   requiresPass: true  },
  { id: 'contractor_engineer', label: 'Contractor',        icon: Wrench,     hours: 4.0,  passType: 'contractor', requiresPass: true  },
  { id: 'casual_staff_banquet',label: 'Casual',            icon: Users,      hours: 8.0,  passType: 'casual',     requiresPass: false },
  { id: 'hotel_guest_visitor', label: 'Visitor',           icon: UserCheck,  hours: 2.0,  passType: 'visitor',    requiresPass: true  },
];

const GATE_OPTIONS = [
  'Loading Bay / BOH Gate',
  'Main Lobby Concierge',
  'Staff Time Office',
  'Contractor West Gate',
];

/* ── Department presets ── */
const CASUAL_DEPARTMENTS = [
  'Hk casual',
  'F&b casual',
  'engineering casual',
  'stewarding casual',
  'entertainment casual',
  'others',
];

const STANDARD_DEPARTMENTS = [
  'Finance',
  'Purchasing',
  'Marketing',
  'Executive Office',
  'Front Office / Concierge',
  'Housekeeping',
  'Food & Beverage',
  'Main Kitchen',
  'Engineering / Maintenance',
  'Security',
  'Receiving / Loading Bay',
  'others',
];

const CONTRACTOR_WORK_TYPES = [
  'Electrical',
  'Confined space',
  'Work on height',
  'Hot work',
  'others',
];

const PASS_PREFIX = { supplier: 'S', contractor: 'C', visitor: 'V' };

function fmtDuration(inTime) {
  if (!inTime) return '';
  const mins = Math.round((Date.now() - new Date(inTime).getTime()) / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function expiryIsPast(d) {
  if (!d) return false;
  return new Date(`${d}T23:59:59`).getTime() < Date.now();
}

/* ══════════════════════════════════════════════════════════════
   PIN PAD
══════════════════════════════════════════════════════════════ */
function PinPad({ onComplete, disabled, loading }) {
  const [pin, setPin] = useState('');

  const press = useCallback((k) => {
    if (disabled || loading) return;
    if ('vibrate' in navigator) navigator.vibrate(8);
    setPin((prev) => {
      const next = prev + k;
      if (next.length === 6) {
        setTimeout(() => { onComplete(next); setPin(''); }, 50);
        return next;
      }
      return next.length <= 6 ? next : prev;
    });
  }, [disabled, loading, onComplete]);

  const del = () => { if (!disabled) setPin((p) => p.slice(0, -1)); };

  const keys = [1,2,3,4,5,6,7,8,9,'⌫',0,null];

  return (
    <div>
      {/* dots */}
      <div className="flex justify-center gap-3 mb-6">
        {[0,1,2,3,4,5].map((i) => (
          <div key={i} className={`h-3.5 w-3.5 rounded-full transition-all duration-200 ${
            i < pin.length
              ? 'bg-indigo-400 scale-110 shadow-[0_0_8px_rgba(99,102,241,0.6)]'
              : 'bg-white/10 border border-white/20'
          }`} />
        ))}
      </div>
      {/* keypad */}
      <div className="grid grid-cols-3 gap-2.5">
        {keys.map((k, idx) => {
          if (k === null) return <div key={idx} />;
          if (k === '⌫') return (
            <button key={idx} type="button" onClick={del} disabled={disabled}
              className="h-14 rounded-xl border border-white/10 bg-white/5 text-lg text-slate-300 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-30">
              ⌫
            </button>
          );
          return (
            <button key={idx} type="button" onClick={() => press(String(k))}
              disabled={disabled || loading || pin.length >= 6}
              className="h-14 rounded-xl border border-white/10 bg-white/5 text-xl font-bold text-white hover:bg-indigo-600/20 hover:border-indigo-500/40 active:scale-95 transition-all disabled:opacity-30 select-none">
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   GUARD LOGIN
══════════════════════════════════════════════════════════════ */
function GuardLogin({ onLogin, notify }) {
  const [guards,   setGuards]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState('');
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    supabase.from('guards').select('id,name').eq('is_active', true).order('name')
      .then(({ data, error }) => {
        if (error) notify('Could not load guard list — run the Phase 2 SQL migration first.', 'error');
        setGuards(data || []);
        setLoading(false);
      });
  }, [notify]);

  const handlePin = async (pin) => {
    if (!selected) { setErr('Select your name first'); return; }
    setBusy(true); setErr('');
    try {
      const pinHash = await hashPin(pin, selected.name);
      const { data, error } = await supabase.rpc('verify_guard_pin', {
        p_name: selected.name, p_pin_hash: pinHash,
      });
      if (error) throw error;
      if (!data?.success) { setErr(data?.error || 'Incorrect PIN. Try again.'); return; }
      notify(`Welcome, ${data.name} 👋`, 'success');
      onLogin({ id: data.guard_id, name: data.name });
    } catch (e) {
      setErr(e.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[100px]" />

      <div className={`relative w-full max-w-sm p-8 ${CARD}`}>
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-xl shadow-indigo-900/50">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Guard Login</h1>
          <p className="mt-1 text-sm text-slate-400">Hotel Security Terminal</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-indigo-400" /></div>
        ) : guards.length === 0 ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-900/20 px-4 py-5 text-center text-sm text-amber-300">
            No active guards found.<br />Ask your manager to create your account at <strong>/admin</strong>.
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className={LABEL}>Select Your Name</label>
              <div className="relative">
                <select
                  value={selected?.id || ''}
                  onChange={(e) => { setErr(''); setSelected(guards.find((g) => g.id === e.target.value) || null); }}
                  className={`${INPUT} pr-9 appearance-none cursor-pointer`}
                >
                  <option value="">— Choose your name —</option>
                  {guards.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
              </div>
            </div>

            <div className="mb-2">
              <label className={LABEL}>6-Digit PIN</label>
              <PinPad onComplete={handlePin} disabled={!selected} loading={busy} />
            </div>

            {busy && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-indigo-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
              </div>
            )}

            {err && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-950/60 px-3 py-2 text-sm text-red-300">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {err}
              </div>
            )}
          </>
        )}

        <div className="mt-6 border-t border-white/5 pt-4 text-center">
          <a href="/admin" className="text-xs text-slate-500 hover:text-indigo-400 transition-colors">
            Manager Portal →
          </a>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SHIFT START
══════════════════════════════════════════════════════════════ */
function ShiftStart({ guard, onStart, onLogout, notify }) {
  const [gate, setGate] = useState(GATE_OPTIONS[0]);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.from('guard_shifts')
      .insert([{ guard_name: guard.name, gate_location: gate, status: 'active' }])
      .select().single();
    setBusy(false);
    if (error) return notify(error.message, 'error');
    notify(`Shift started — ${gate}`, 'success');
    onStart(data);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[400px] w-[400px] rounded-full bg-indigo-600/10 blur-[80px]" />
      <div className={`relative w-full max-w-md p-8 ${CARD}`}>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-900/40">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">On Duty</p>
              <p className="text-lg font-bold text-indigo-300">{guard.name}</p>
            </div>
          </div>
          <button onClick={onLogout} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition" title="Logout">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mb-5 text-xl font-bold">Start Duty Shift</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={LABEL}>Gate / Location</label>
            <div className="relative">
              <select value={gate} onChange={(e) => setGate(e.target.value)} className={`${INPUT} pr-9 appearance-none`}>
                {GATE_OPTIONS.map((g) => <option key={g}>{g}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
            </div>
          </div>
          <button type="submit" disabled={busy} className={`${BTN_PRI} w-full py-3.5 text-sm`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Start Duty Shift
          </button>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   GUARD TERMINAL  (main check-in screen)
══════════════════════════════════════════════════════════════ */
function GuardTerminal({ guard, shift, onEndShift, onLogout, notify }) {
  /* ── Form state ── */
  const [trafficType,   setTrafficType]   = useState('supplier_delivery');
  const [docNumber,     setDocNumber]     = useState('');
  const [fullName,      setFullName]      = useState('');
  const [mobileNumber,  setMobileNumber]  = useState('');
  const [companyName,   setCompanyName]   = useState('');
  const [vehiclePlate,  setVehiclePlate]  = useState('');
  const [nationality,   setNationality]   = useState('');
  const [idExpiryDate,  setIdExpiryDate]  = useState('');
  const [hostDept,      setHostDept]      = useState('');
  const [deptSelection, setDeptSelection] = useState('');
  const [manualDept,    setManualDept]    = useState('');
  const [whomToVisit,   setWhomToVisit]   = useState('');
  const [contractorWorkType, setContractorWorkType] = useState('');
  const [manualWorkType,     setManualWorkType]     = useState('');
  const [workPermitNumber,   setWorkPermitNumber]   = useState('');
  const [areaOfWork,         setAreaOfWork]         = useState('');
  const [selectedPass,  setSelectedPass]  = useState('');
  const [allowedHours,  setAllowedHours]  = useState(0.75);
  const [isIdExpired,   setIsIdExpired]   = useState(false);
  const [statusMsg,     setStatusMsg]     = useState('');
  const [submitting,    setSubmitting]    = useState(false);

  /* ── Data state ── */
  const [logs,           setLogs]           = useState([]);
  const [availablePasses,setAvailablePasses] = useState([]);
  const [passesLoading,  setPassesLoading]   = useState(false);
  const [noPasses,       setNoPasses]        = useState(false);

  /* ── Scanner state ── */
  const [scannerOpen,    setScannerOpen]    = useState(false);
  const [scannerMsg,     setScannerMsg]     = useState('');
  const [captureStatus,  setCaptureStatus]  = useState(null);
  const [viewfinderState,setViewfinderState]= useState('searching');

  /* ── Handover modal ── */
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverNote, setHandoverNote] = useState('');
  const [endingShift,  setEndingShift]  = useState(false);

  /* ── NFC state ── */
  const [nfcActive,       setNfcActive]       = useState(false);
  const [nfcCheckoutMode, setNfcCheckoutMode] = useState(false);

  /* ── Refs ── */
  const videoRef           = useRef(null);
  const cameraStreamRef    = useRef(null);
  const scanLoopRef        = useRef(null);
  const barcodeReaderRef   = useRef(null);
  const barcodeDetectorRef = useRef(null);
  const preserveScanFields = useRef(false);

  /* ── Derived ── */
  const currentTrafficConfig = TRAFFIC_TYPES.find((t) => t.id === trafficType) || TRAFFIC_TYPES[0];
  const requiresPass = currentTrafficConfig.requiresPass;
  const currentPassType = currentTrafficConfig.passType;
  const insideLogs = logs.filter((l) => l.status === 'inside');
  const overstays  = insideLogs.filter((l) => {
    const ah = l.allowed_hours || 2;
    return (Date.now() - new Date(l.check_in_time).getTime()) / 3600000 > ah;
  });

  /* ── Effects ── */
  useEffect(() => {
    fetchLogs();
    const channel = supabase.channel('guard-terminal-logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hotel_security_logs' }, fetchLogs)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [shift]);

  useEffect(() => {
    const t = TRAFFIC_TYPES.find((x) => x.id === trafficType);
    if (t) setAllowedHours(t.hours);
    setSelectedPass('');
    setDeptSelection('');
    setHostDept('');
    setManualDept('');
    setWhomToVisit('');
    setContractorWorkType('');
    setManualWorkType('');
    setWorkPermitNumber('');
    setAreaOfWork('');
    if (t?.requiresPass) {
      fetchPasses(t.passType);
    }
  }, [trafficType]);

  useEffect(() => () => { stopScanner(); }, []);

  /* ── Data fetchers ── */
  const fetchLogs = useCallback(async () => {
    const { data } = await supabase.from('hotel_security_logs')
      .select('*').eq('shift_id', shift.id).order('check_in_time', { ascending: false });
    setLogs(data || []);
  }, [shift.id]);

  const fetchPasses = useCallback(async (passType) => {
    setPassesLoading(true);
    const { data } = await supabase.from('passes')
      .select('id,pass_number,pass_type,nfc_uid')
      .eq('pass_type', passType).eq('status', 'available').order('pass_number');
    setAvailablePasses(data || []);
    setNoPasses((data || []).length === 0);
    setPassesLoading(false);
  }, []);

  /* ── Beep ── */
  const beep = useCallback((ok = true) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.value = ok ? 880 : 220;
      osc.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + (ok ? 0.12 : 0.25));
    } catch {}
  }, []);

  /* ── Form helpers ── */
  const resetForm = () => {
    setDocNumber(''); setFullName(''); setMobileNumber(''); setCompanyName('');
    setVehiclePlate(''); setNationality(''); setIdExpiryDate(''); setHostDept('');
    setDeptSelection(''); setManualDept(''); setWhomToVisit('');
    setContractorWorkType(''); setManualWorkType(''); setWorkPermitNumber(''); setAreaOfWork('');
    setSelectedPass(''); setIsIdExpired(false); setStatusMsg('');
    const t = TRAFFIC_TYPES.find((x) => x.id === trafficType);
    if (t) setAllowedHours(t.hours);
    if (t?.requiresPass) fetchPasses(t.passType);
  };

  /* ── Auto-lookup from history ── */
  const handleDocSearch = useCallback(async (val) => {
    if (preserveScanFields.current) { preserveScanFields.current = false; return; }
    if (val.length < 4) return;
    const { data } = await supabase.from('hotel_security_logs')
      .select('full_name,mobile_number,company_name,vehicle_plate,nationality,id_expiry_date')
      .or(`doc_number.ilike.%${val}%,mobile_number.ilike.%${val}%,vehicle_plate.ilike.%${val}%`)
      .order('check_in_time', { ascending: false }).limit(1).maybeSingle();
    if (data) {
      if (data.full_name)    setFullName(data.full_name);
      if (data.mobile_number)setMobileNumber(data.mobile_number);
      if (data.company_name) setCompanyName(data.company_name);
      if (data.vehicle_plate)setVehiclePlate(data.vehicle_plate);
      if (data.nationality)  setNationality(data.nationality);
      if (data.id_expiry_date){ setIdExpiryDate(data.id_expiry_date); setIsIdExpired(expiryIsPast(data.id_expiry_date)); }
    }
  }, []);

  /* ── Apply OCR extracted fields ── */
  const applyExtractedFields = useCallback(({ documentNumber, fullName: n, nationality: nat, expiryDate, docType }) => {
    preserveScanFields.current = true;
    if (documentNumber) setDocNumber(String(documentNumber).replace(/</g, ''));
    if (n)   setFullName(String(n).replace(/</g, ' ').replace(/\s+/g, ' ').trim());
    if (nat) setNationality(String(nat).replace(/</g, '').trim());
    if (expiryDate) { setIdExpiryDate(expiryDate); }
    const exp = expiryIsPast(expiryDate);
    setIsIdExpired(exp);
    return exp;
  }, []);

  /* ── Barcode parser ── */
  const parseBarcodePayload = useCallback((raw) => {
    if (!raw) return null;
    const eid = raw.match(/^(784\d{12})$/) || raw.match(/^784-\d{4}-\d{7}-\d$/);
    if (eid) return { documentNumber: raw.replace(/[^0-9]/g, '').replace(/^(784)(\d{4})(\d{7})(\d)$/, '$1-$2-$3-$4') };
    const td3 = raw.match(/^([A-Z0-9<]{44})\n([A-Z0-9<]{44})$/m);
    if (td3) {
      const l1 = td3[1], l2 = td3[2];
      const docNum = l2.substring(0, 9).replace(/</g, '');
      const nat    = l2.substring(10, 13);
      const yy     = parseInt(l2.substring(19, 21), 10);
      const yr     = yy <= 49 ? 2000 + yy : 1900 + yy;
      const mo     = l2.substring(21, 23), da = l2.substring(23, 25);
      const surParts = l1.substring(5).split('<<');
      const sur  = (surParts[0] || '').replace(/</g, ' ').trim();
      const give = (surParts[1] || '').replace(/</g, ' ').trim();
      return { documentNumber: docNum, fullName: `${give} ${sur}`.trim(), nationality: nat, expiryDate: `${yr}-${mo}-${da}` };
    }
    return null;
  }, []);

  /* ── Camera scanner ── */
  const stopScanner = useCallback(() => {
    if (scanLoopRef.current) { cancelAnimationFrame(scanLoopRef.current); scanLoopRef.current = null; }
    if (barcodeReaderRef.current) { try { barcodeReaderRef.current.reset(); } catch {} barcodeReaderRef.current = null; }
    if (cameraStreamRef.current) { cameraStreamRef.current.getTracks().forEach((t) => t.stop()); cameraStreamRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; }
  }, []);

  const openDocumentScanner = useCallback(async () => {
    setScannerOpen(true);
    setScannerMsg('Requesting camera…');
    setCaptureStatus(null);
    setViewfinderState('searching');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setScannerMsg('Position document in frame, then tap Capture & Read');
      startLiveScanner();
    } catch (e) {
      setScannerMsg(`Camera error: ${e.message}`);
    }
  }, []);

  const closeDocumentScanner = useCallback(() => {
    stopScanner(); setScannerOpen(false); setScannerMsg(''); setCaptureStatus(null); setViewfinderState('searching');
  }, [stopScanner]);

  const startLiveScanner = useCallback(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417, BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128]);
    barcodeReaderRef.current = new BrowserMultiFormatReader(hints);
    const loop = () => {
      if (!videoRef.current || !videoRef.current.videoWidth) { scanLoopRef.current = requestAnimationFrame(loop); return; }
      const cv = document.createElement('canvas');
      cv.width = videoRef.current.videoWidth; cv.height = videoRef.current.videoHeight;
      cv.getContext('2d').drawImage(videoRef.current, 0, 0);
      barcodeReaderRef.current.decodeFromCanvas(cv)
        .then((result) => {
          const parsed = parseBarcodePayload(result.getText());
          if (parsed) {
            applyScanResult(parsed);
          } else {
            scanLoopRef.current = requestAnimationFrame(loop);
          }
        })
        .catch(() => { scanLoopRef.current = requestAnimationFrame(loop); });
    };
    scanLoopRef.current = requestAnimationFrame(loop);
  }, [parseBarcodePayload]);

  const applyScanResult = useCallback((parsed) => {
    if (!parsed?.documentNumber && !parsed?.fullName) return;
    const exp = applyExtractedFields({ ...parsed, documentNumber: parsed.documentNumber });
    beep(!exp);
    if ('vibrate' in navigator) navigator.vibrate([40, 30, 80]);
    setViewfinderState('captured');
    setStatusMsg(exp ? '⚠️ EXPIRED DOCUMENT' : 'Document locked.');
    notify(exp ? '⚠️ Document EXPIRED' : 'Document scanned', exp ? 'error' : 'success');
    setTimeout(() => closeDocumentScanner(), 400);
  }, [applyExtractedFields, beep, closeDocumentScanner, notify]);

  const captureAndRead = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) { setScannerMsg('Camera not ready — try again.'); return; }
    setCaptureStatus('reading'); setScannerMsg('Reading document…');
    try {
      const cv = document.createElement('canvas');
      const scale = Math.min(1, 1280 / v.videoWidth);
      cv.width = Math.round(v.videoWidth * scale); cv.height = Math.round(v.videoHeight * scale);
      cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
      const image = cv.toDataURL('image/jpeg', 0.85).split(',')[1];

      const { data, error } = await supabase.functions.invoke('scan-id', { body: { image } });

      if (error) {
        let msg = error?.message || 'Unknown error';
        try { if (error?.context) { const b = await error.context.json(); if (b?.error) msg = b.error; } } catch {}
        setCaptureStatus('empty'); beep(false); setScannerMsg(msg); return;
      }

      const ext = data?.extracted;
      if (ext && (ext.docNumber || ext.fullName)) {
        const exp = applyExtractedFields({
          documentNumber: ext.docNumber, fullName: ext.fullName,
          nationality: ext.nationality, expiryDate: ext.expiryDate, docType: ext.docType,
        });
        setViewfinderState('captured'); setCaptureStatus('success'); setScannerMsg('');
        beep(!exp);
        if ('vibrate' in navigator) navigator.vibrate(exp ? [80, 60, 80] : [40, 30, 80]);
        notify(exp ? '⚠️ Document EXPIRED' : 'Document captured', exp ? 'error' : 'success');
        setTimeout(() => closeDocumentScanner(), 400);
      } else {
        setCaptureStatus('empty'); beep(false);
        setScannerMsg(data?.error || 'No ID data found. Fill the frame and try again.');
      }
    } catch (e) {
      setCaptureStatus('empty'); beep(false); setScannerMsg(`Error: ${e?.message}`);
    }
  }, [applyExtractedFields, beep, closeDocumentScanner, notify]);

  /* ── Check-out ── */
  const handleCheckOut = useCallback(async (id, passNum) => {
    const { error } = await supabase.from('hotel_security_logs').update({
      status:          'checked_out',
      check_out_time:  new Date().toISOString(),
      checkout_by_guard: guard.name,
    }).eq('id', id);
    if (error) return notify(error.message, 'error');
    if (passNum) await supabase.from('passes').update({ status: 'available' }).eq('pass_number', passNum);
    beep(true);
    if ('vibrate' in navigator) navigator.vibrate([40, 30, 80]);
    notify(`Pass ${passNum} checked out`, 'success');
    fetchLogs(); fetchPasses(currentPassType);
  }, [guard.name, notify, beep, fetchLogs, fetchPasses, currentPassType]);

  /* ── NFC check-in (pass picker) ── */
  const startNfcScan = useCallback(async () => {
    if (!('NDEFReader' in window)) {
      notify('NFC not available. Use Android Chrome.', 'info'); return;
    }
    try {
      const ndef = new window.NDEFReader();
      await ndef.scan();
      setNfcActive(true);
      notify('NFC ready — hold badge to back of phone', 'info');
      ndef.onreading = async ({ serialNumber }) => {
        const uid = serialNumber.replace(/:/g, '').toUpperCase();
        const { data: pass } = await supabase.from('passes').select('*').eq('nfc_uid', uid).maybeSingle();
        if (!pass) { notify(`NFC tag not registered (${uid}). Link in Manager → Passes.`, 'info'); return; }
        if (pass.status === 'available') {
          setSelectedPass(pass.pass_number);
          const tt = TRAFFIC_TYPES.find((t) => t.passType === pass.pass_type);
          if (tt) setTrafficType(tt.id);
          notify(`Pass ${pass.pass_number} ready — fill visitor details`, 'success');
          if ('vibrate' in navigator) navigator.vibrate([40, 30, 80]);
          setNfcActive(false);
        } else if (pass.status === 'in_use') {
          const al = insideLogs.find((l) => l.pass_badge_no === pass.pass_number);
          if (al) { await handleCheckOut(al.id, pass.pass_number); setNfcActive(false); }
          else { notify(`Pass ${pass.pass_number} in use but not in this shift. Check manually.`, 'info'); }
        }
      };
    } catch (e) {
      setNfcActive(false); notify('NFC error: ' + e.message, 'error');
    }
  }, [insideLogs, notify]);

  /* ── NFC checkout mode (active passes card) ── */
  const startNfcCheckout = useCallback(async () => {
    if (!('NDEFReader' in window)) {
      notify('NFC not available on this device. Use Android Chrome.', 'info'); return;
    }
    try {
      const ndef = new window.NDEFReader();
      await ndef.scan();
      setNfcCheckoutMode(true);
      notify('NFC Checkout active — tap returning visitor\'s badge on phone', 'success');
      if ('vibrate' in navigator) navigator.vibrate(40);

      ndef.onreading = async ({ serialNumber }) => {
        const uid = serialNumber.replace(/:/g, '').toUpperCase();
        const { data: pass } = await supabase.from('passes').select('*').eq('nfc_uid', uid).maybeSingle();
        if (!pass) {
          notify(`NFC tag not registered (${uid}). Link in Manager → Passes.`, 'info');
          if ('vibrate' in navigator) navigator.vibrate([80, 60, 80]);
          return;
        }
        if (pass.status === 'in_use') {
          // Find matching active log
          const { data: logs } = await supabase.from('hotel_security_logs')
            .select('id,full_name,pass_badge_no')
            .eq('pass_badge_no', pass.pass_number)
            .eq('status', 'inside')
            .maybeSingle();
          if (logs) {
            await handleCheckOut(logs.id, pass.pass_number);
            notify(`✅ ${logs.full_name} auto checked out — Pass ${pass.pass_number} returned`, 'success');
            if ('vibrate' in navigator) navigator.vibrate([40, 30, 80]);
          } else {
            notify(`Pass ${pass.pass_number} in use but not in this shift. Check manually.`, 'info');
          }
        } else if (pass.status === 'available') {
          notify(`Pass ${pass.pass_number} is already available — not checked in.`, 'info');
          if ('vibrate' in navigator) navigator.vibrate([80, 60, 80]);
        }
      };

      ndef.onerror = () => { setNfcCheckoutMode(false); notify('NFC error. Try again.', 'error'); };
    } catch (e) {
      setNfcCheckoutMode(false); notify('NFC error: ' + e.message, 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notify]); // handleCheckOut captured from closure — safe, defined by first render paint


  /* ── Check-in with strict completeness validation ── */
  const handleCheckIn = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) return notify('Full Name is required', 'error');
    if (!docNumber.trim()) return notify('Document / Emirates ID number is required', 'error');
    if (!companyName.trim()) return notify('Company / Organization / Agency is required', 'error');
    if (!mobileNumber.trim()) return notify('Mobile Number is required', 'error');
    if (!vehiclePlate.trim()) return notify('Vehicle Plate or Walk-in is required', 'error');
    const baseDept = deptSelection === 'others' ? manualDept.trim() : hostDept.trim();
    if (!baseDept) return notify('Destination / Department is required', 'error');

    if (trafficType === 'hotel_guest_visitor' && !whomToVisit.trim()) {
      return notify('Please specify whom the visitor is going to visit', 'error');
    }

    if (trafficType === 'contractor_engineer') {
      const effectiveWork = contractorWorkType === 'others' ? manualWorkType.trim() : contractorWorkType.trim();
      if (!effectiveWork) return notify('Contractor kind of work is required', 'error');
      if (!workPermitNumber.trim()) return notify('Work Permit Number (PTW #) is required', 'error');
      if (!areaOfWork.trim()) return notify('Area of Work is required', 'error');
    }

    if (requiresPass && !selectedPass) {
      return notify('Please select or tap a pass badge first', 'error');
    }
    if (isIdExpired) return notify('⛔ ACCESS DENIED — Document is expired', 'error');

    setSubmitting(true);

    let effectiveDept = baseDept;
    let purpose = 'Standard Entry';

    if (trafficType === 'hotel_guest_visitor' && whomToVisit.trim()) {
      effectiveDept = `${baseDept} (Visiting: ${whomToVisit.trim()})`;
      purpose = `Visitor: Visiting ${whomToVisit.trim()}`;
    } else if (trafficType === 'contractor_engineer') {
      const effectiveWork = contractorWorkType === 'others' ? manualWorkType.trim() : contractorWorkType.trim();
      effectiveDept = `${baseDept} — Area: ${areaOfWork.trim()}`;
      purpose = `Contractor: ${effectiveWork} (PTW: ${workPermitNumber.trim()})`;
    } else if (trafficType === 'casual_staff_banquet') {
      purpose = `Casual Shift (${allowedHours}h)`;
    }

    const assignedBadge = requiresPass ? selectedPass : 'CASUAL';

    const { error: logErr } = await supabase.from('hotel_security_logs').insert([{
      shift_id:          shift.id,
      logged_by_guard:   guard.name,
      full_name:         fullName.trim(),
      doc_number:        docNumber.trim(),
      mobile_number:     mobileNumber.trim(),
      company_name:      companyName.trim(),
      vehicle_plate:     vehiclePlate.trim(),
      nationality:       nationality.trim(),
      id_expiry_date:    idExpiryDate || null,
      traffic_type:      trafficType,
      purpose_of_visit:  purpose,
      host_room_or_dept: effectiveDept,
      pass_badge_no:     assignedBadge,
      allowed_hours:     Number(allowedHours) || 2,
      status:            'inside',
    }]);

    if (logErr) { setSubmitting(false); return notify(logErr.message, 'error'); }

    if (requiresPass && selectedPass) {
      await supabase.from('passes').update({ status: 'in_use' }).eq('pass_number', selectedPass);
    }

    beep(true);
    if ('vibrate' in navigator) navigator.vibrate([40, 30, 80]);
    notify(`✅ ${fullName} checked in — ${requiresPass ? `Pass ${selectedPass} issued` : 'Casual Logged'}`, 'success');
    resetForm();
    setSubmitting(false);
  };



  /* ── End shift ── */
  const handleEndShift = async () => {
    if (insideLogs.length > 0 && !handoverNote) {
      return notify('Add a handover note — there are visitors still inside', 'error');
    }
    setEndingShift(true);
    await supabase.from('guard_shifts').update({
      status: 'completed', handover_notes: handoverNote,
      end_time: new Date().toISOString(),
    }).eq('id', shift.id);
    setEndingShift(false);
    setHandoverOpen(false);
    notify('Shift ended. Stay safe!', 'success');
    onEndShift();
  };

  /* ── Viewfinder classes ── */
  const vfRing = viewfinderState === 'captured'
    ? 'ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
    : 'ring-1 ring-white/20';

  /* ═══════════════════════ RENDER ═══════════════════════════ */
  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-900/40">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold leading-none text-white">{shift.gate_location}</p>
              <p className="text-[10px] text-indigo-400">On Duty: <span className="font-bold">{guard.name}</span></p>
            </div>
          </div>
          <button onClick={() => setHandoverOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-semibold text-red-300 border border-red-500/30 hover:bg-red-600/30 transition">
            <LogOut className="h-3.5 w-3.5" /> End Shift
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4 pb-20">

        {/* ── Stat tiles ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Inside Now',     value: insideLogs.length, color: 'text-blue-400'   },
            { label: 'Overstay Alerts',value: overstays.length,  color: 'text-red-400'    },
            { label: 'Total Processed',value: logs.length,       color: 'text-emerald-400'},
          ].map((s) => (
            <div key={s.label} className={`${CARD} p-4`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
              <p className={`mt-1 text-3xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Check-in form ── */}
        <div className={`${CARD} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <UserCheck className="h-4 w-4 text-indigo-400" /> Fast Pass Check-In
            </h2>
            <button type="button" onClick={scannerOpen ? closeDocumentScanner : openDocumentScanner}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                scannerOpen ? 'bg-red-600/20 text-red-300 border border-red-500/30' : 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30'
              }`}>
              <Camera className="h-3.5 w-3.5" /> {scannerOpen ? 'Close Scanner' : 'Scan Document'}
            </button>
          </div>

          {/* ── Camera scanner modal ── */}
          {scannerOpen && (
            <div className="mb-4 rounded-xl border border-white/10 bg-black overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-900">
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <ScanLine className="h-3.5 w-3.5 text-indigo-400" /> Passport / Emirates ID Scanner
                </span>
                <button onClick={closeDocumentScanner} className="text-slate-400 hover:text-white transition">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative">
                <video ref={videoRef} className="w-full" playsInline muted />
                {/* Viewfinder */}
                <div className={`absolute inset-2 rounded-lg transition-all duration-500 ${vfRing}`}>
                  {viewfinderState === 'searching' && (
                    <>
                      {[['top-0 left-0 border-t-2 border-l-2 rounded-tl-lg', 'h-7 w-7'],
                        ['top-0 right-0 border-t-2 border-r-2 rounded-tr-lg', 'h-7 w-7'],
                        ['bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg', 'h-7 w-7'],
                        ['bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg', 'h-7 w-7'],
                      ].map(([cls, sz], i) => (
                        <div key={i} className={`absolute border-red-500 ${cls} ${sz}`} />
                      ))}
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/50 bg-slate-950/80 px-3 py-1 text-xs font-bold text-red-400 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> SEARCHING
                        </span>
                      </div>
                    </>
                  )}
                  {viewfinderState === 'captured' && (
                    <div className="flex h-full items-center justify-center">
                      <CheckCircle2 className="h-12 w-12 text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 p-3">
                <button type="button" onClick={captureAndRead} disabled={captureStatus === 'reading'}
                  className={`${BTN_PRI} flex-1 py-2.5 text-sm`}>
                  {captureStatus === 'reading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {captureStatus === 'reading' ? 'Reading…' : 'Capture & Read'}
                </button>
                <button type="button" onClick={closeDocumentScanner} className={`${BTN_SEC} px-4 py-2.5 text-sm`}>Close</button>
              </div>
              {scannerMsg && (
                <p className={`px-3 pb-3 text-xs ${captureStatus === 'empty' ? 'text-amber-400' : 'text-indigo-400'}`}>{scannerMsg}</p>
              )}
            </div>
          )}

          {/* ── Traffic type selector ── */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            {TRAFFIC_TYPES.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setTrafficType(id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                  trafficType === id
                    ? 'border-indigo-500/60 bg-indigo-600/20 text-indigo-300 shadow-inner'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}>
                <Icon className="h-4 w-4 flex-shrink-0" /> {label}
              </button>
            ))}
          </div>

          {/* ── Form fields ── */}
          <form onSubmit={handleCheckIn} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL}>
                  Doc # / ID Number <span className="text-red-400">*</span>
                </label>
                <input value={docNumber} onChange={(e) => { setDocNumber(e.target.value); handleDocSearch(e.target.value); }}
                  placeholder="784-1985-..." className={INPUT} required />
              </div>
              <div>
                <label className={LABEL}>
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Visitor name" className={INPUT} required />
              </div>
              <div>
                <label className={LABEL}>
                  Company / Agency <span className="text-red-400">*</span>
                </label>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Al Naboodah / Supplier" className={INPUT} required />
              </div>
              <div>
                <label className={LABEL}>
                  Mobile Number <span className="text-red-400">*</span>
                </label>
                <input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} placeholder="05x xxx xxxx" className={INPUT} required />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Vehicle Plate <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setVehiclePlate(vehiclePlate === 'Walk-in' ? '' : 'Walk-in')}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition ${
                      vehiclePlate === 'Walk-in'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {vehiclePlate === 'Walk-in' ? '✓ Walk-in Active' : '🚶 Walk-in'}
                  </button>
                </div>
                <input
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder={vehiclePlate === 'Walk-in' ? 'Walk-in' : 'DXB A 45892 (or click Walk-in)'}
                  className={`${INPUT} ${vehiclePlate === 'Walk-in' ? '!border-emerald-500/50 !text-emerald-300 font-semibold' : ''}`}
                  required
                />
              </div>
              <div>
                <label className={LABEL}>Nationality</label>
                <input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="From MRZ scan" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Document Expiry</label>
                <input type="date" value={idExpiryDate}
                  onChange={(e) => { setIdExpiryDate(e.target.value); setIsIdExpired(expiryIsPast(e.target.value)); }}
                  className={`${INPUT} ${isIdExpired ? '!border-red-500' : ''}`} />
                {isIdExpired && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-red-500/50 bg-red-600/20 px-2 py-0.5 text-xs font-bold text-red-300 animate-pulse">
                    ⚠️ EXPIRED
                  </span>
                )}
              </div>
              <div>
                <label className={LABEL}>
                  Destination / Dept <span className="text-red-400">*</span>
                </label>
                <select
                  value={deptSelection}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDeptSelection(val);
                    if (val !== 'others') {
                      setHostDept(val);
                      setManualDept('');
                    } else {
                      setHostDept(manualDept);
                    }
                  }}
                  className={`${INPUT} appearance-none cursor-pointer`}
                  required
                >
                  <option value="">— Select Department —</option>
                  {(trafficType === 'casual_staff_banquet' ? CASUAL_DEPARTMENTS : STANDARD_DEPARTMENTS).map((d) => (
                    <option key={d} value={d}>
                      {d === 'others' ? 'Others (Type Manually)' : d}
                    </option>
                  ))}
                </select>
                {deptSelection === 'others' && (
                  <input
                    type="text"
                    value={manualDept}
                    onChange={(e) => {
                      setManualDept(e.target.value);
                      setHostDept(e.target.value);
                    }}
                    placeholder="Enter manual department name"
                    className={`${INPUT} mt-2`}
                    required
                  />
                )}
              </div>

              {trafficType === 'hotel_guest_visitor' && (
                <div className="sm:col-span-2">
                  <label className={LABEL}>
                    Whom to Visit (Host / Manager Name) <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={whomToVisit}
                    onChange={(e) => setWhomToVisit(e.target.value)}
                    placeholder="e.g. John Smith / Finance Manager / General Manager"
                    className={INPUT}
                    required
                  />
                </div>
              )}

              {/* ── Contractor specific fields ── */}
              {trafficType === 'contractor_engineer' && (
                <>
                  <div>
                    <label className={LABEL}>
                      Kind of Work <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={contractorWorkType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setContractorWorkType(val);
                        if (val !== 'others') setManualWorkType('');
                      }}
                      className={`${INPUT} appearance-none cursor-pointer`}
                      required
                    >
                      <option value="">— Select Kind of Work —</option>
                      {CONTRACTOR_WORK_TYPES.map((w) => (
                        <option key={w} value={w}>
                          {w === 'others' ? 'Others (Type Manually)' : w}
                        </option>
                      ))}
                    </select>
                    {contractorWorkType === 'others' && (
                      <input
                        type="text"
                        value={manualWorkType}
                        onChange={(e) => setManualWorkType(e.target.value)}
                        placeholder="Enter custom kind of work"
                        className={`${INPUT} mt-2`}
                        required
                      />
                    )}
                  </div>

                  <div>
                    <label className={LABEL}>
                      Work Permit Number (PTW #) <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={workPermitNumber}
                      onChange={(e) => setWorkPermitNumber(e.target.value)}
                      placeholder="e.g. PTW-2026-089 / WP-458"
                      className={INPUT}
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={LABEL}>
                      Area of Work / Precise Location <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={areaOfWork}
                      onChange={(e) => setAreaOfWork(e.target.value)}
                      placeholder="e.g. Roof Chiller Plant / Substation 2 / Kitchen Exhaust Duct"
                      className={INPUT}
                      required
                    />
                  </div>
                </>
              )}

              {/* ── Expected stay / work duration selector ── */}
              <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-indigo-400" />
                    {trafficType === 'casual_staff_banquet'
                      ? 'Expected Work Duration (Shift Hours)'
                      : trafficType === 'contractor_engineer'
                      ? 'Contractor Authorized Work Duration'
                      : 'Allowed Stay Duration'}
                  </label>
                  <span className="text-xs font-bold text-white tabular-nums bg-indigo-600/30 border border-indigo-500/40 px-2 py-0.5 rounded-lg">
                    {allowedHours} {allowedHours === 1 ? 'hour' : 'hours'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(trafficType === 'casual_staff_banquet' ? [4, 6, 8, 9, 12] : trafficType === 'contractor_engineer' ? [2, 4, 6, 8, 12] : [0.75, 1, 2, 4, 8]).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setAllowedHours(h)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                        allowedHours === h
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-900/40'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {h < 1 ? `${Math.round(h * 60)} mins` : `${h} hrs`}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs text-slate-400">Custom:</span>
                    <input
                      type="number"
                      min="0.25"
                      max="24"
                      step="0.5"
                      value={allowedHours}
                      onChange={(e) => setAllowedHours(parseFloat(e.target.value) || 1)}
                      className="w-16 bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-400">hrs</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Pass picker / Casual notice ── */}
            {requiresPass ? (
              <div>
                <label className={LABEL}>
                  <Tag className="inline h-3 w-3 mr-1" />
                  Select Pass ({PASS_PREFIX[currentPassType]}-xxx available) <span className="text-red-400">*</span>
                </label>
                {passesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading passes…
                  </div>
                ) : noPasses ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-900/20 px-3 py-2 text-xs text-amber-300">
                    No {PASS_PREFIX[currentPassType]}-passes available. Create passes in Manager Portal → Passes.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availablePasses.map((p) => (
                      <button key={p.id} type="button" onClick={() => setSelectedPass(p.pass_number)}
                        className={`font-mono text-xs font-bold px-3 py-2 rounded-lg border transition-all ${
                          selectedPass === p.pass_number
                            ? 'border-indigo-500 bg-indigo-600/30 text-indigo-300 ring-1 ring-indigo-500 shadow-lg shadow-indigo-900/30'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}>
                        {p.pass_number} {p.nfc_uid && <Wifi className="inline h-2.5 w-2.5 ml-0.5 text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={startNfcScan}
                  className={`mt-2 flex items-center gap-1.5 text-xs transition ${nfcActive ? 'text-emerald-400 animate-pulse' : 'text-indigo-400 hover:text-indigo-300'}`}>
                  <Wifi className="h-3.5 w-3.5" /> {nfcActive ? 'NFC Active — Hold badge to phone' : 'Tap NFC Badge'}
                </button>
                {selectedPass && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Pass <strong>{selectedPass}</strong> selected
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-3 flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600/30 text-indigo-300">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Casual Staff Entry — No Physical Pass Needed</p>
                  <p className="text-[11px] text-indigo-300">Entry logged directly into security system for {allowedHours} hours.</p>
                </div>
              </div>
            )}

            {/* ── Expired block ── */}
            {isIdExpired && (
              <div className="flex items-center gap-3 rounded-xl border-2 border-red-500 bg-red-950/60 px-4 py-3 shadow-lg shadow-red-900/40">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-600">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-extrabold uppercase tracking-wide text-red-300">Access Denied — Document Expired</div>
                  <div className="mt-0.5 text-xs text-red-400">Ask visitor for a valid document before issuing entry.</div>
                </div>
              </div>
            )}

            {statusMsg && <div className="font-mono text-xs text-indigo-400">{statusMsg}</div>}

            {(() => {
              const effectiveDept = deptSelection === 'others' ? manualDept.trim() : hostDept.trim();
              const isMissingVisitorHost = trafficType === 'hotel_guest_visitor' && !whomToVisit.trim();
              const effectiveContractorWork = contractorWorkType === 'others' ? manualWorkType.trim() : contractorWorkType.trim();
              const isMissingContractorData = trafficType === 'contractor_engineer' && (!effectiveContractorWork || !workPermitNumber.trim() || !areaOfWork.trim());
              const isMissingData = !fullName.trim() || !docNumber.trim() || !companyName.trim() || !mobileNumber.trim() || !vehiclePlate.trim() || !effectiveDept || isMissingVisitorHost || isMissingContractorData;
              const isMissingPass = requiresPass && !selectedPass;
              const isDisabled = submitting || isIdExpired || isMissingPass || isMissingData;

              return (
                <button
                  type="submit"
                  disabled={isDisabled}
                  className={`${BTN_PRI} w-full py-3 text-sm ${
                    isIdExpired
                      ? '!from-red-900 !to-red-900 !opacity-40 cursor-not-allowed'
                      : isDisabled
                      ? '!from-slate-700 !to-slate-800 !opacity-60 cursor-not-allowed'
                      : ''
                  }`}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                  {isIdExpired
                    ? 'Check-In Blocked — Expired Document'
                    : isMissingData
                    ? 'Fill All Required Fields (*)'
                    : isMissingPass
                    ? 'Select or Tap Pass Badge (*)'
                    : requiresPass
                    ? `Confirm Check-In & Issue Pass (${selectedPass})`
                    : `Confirm Check-In (Casual — ${allowedHours}h)`}
                </button>
              );
            })()}
          </form>
        </div>

        {/* ── Active passes ── */}
        <div className={`${CARD} space-y-3 p-5`}>
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">Active On Property ({insideLogs.length})</h2>
            <button
              type="button"
              onClick={nfcCheckoutMode ? () => setNfcCheckoutMode(false) : startNfcCheckout}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                nfcCheckoutMode
                  ? 'border-emerald-500/60 bg-emerald-600/20 text-emerald-300 animate-pulse shadow-lg shadow-emerald-900/30'
                  : 'border-violet-500/30 bg-violet-600/10 text-violet-300 hover:bg-violet-600/20'
              }`}
            >
              <Wifi className="h-3.5 w-3.5" />
              {nfcCheckoutMode ? 'NFC Active — Tap badge' : 'NFC Checkout'}
            </button>
          </div>

          {/* NFC checkout banner */}
          {nfcCheckoutMode && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-sm font-semibold text-emerald-300">
                  Hold returning visitor's badge to back of phone
                </span>
              </div>
              <button onClick={() => setNfcCheckoutMode(false)} className="ml-2 text-emerald-400 hover:text-white transition">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {insideLogs.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No one inside at this gate</p>
          ) : (
            <div className="space-y-2">
              {insideLogs.map((l) => {
                const over = (Date.now() - new Date(l.check_in_time).getTime()) / 3600000 > (l.allowed_hours || 2);
                return (
                  <div key={l.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    over ? 'border-red-500/40 bg-red-950/30' : 'border-white/5 bg-white/5'
                  }`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-300">{l.pass_badge_no}</span>
                        {over && <span className="rounded-full border border-red-500/40 bg-red-600/20 px-1.5 py-0.5 text-[9px] font-bold text-red-300">OVERSTAY</span>}
                      </div>
                      <p className="truncate text-sm font-medium text-white">{l.full_name}</p>
                      <p className="text-[10px] text-slate-400">
                        {l.company_name || l.traffic_type} • {fmtDuration(l.check_in_time)} inside
                      </p>
                    </div>
                    {/* Manual checkout always available as fallback */}
                    <button
                      onClick={() => handleCheckOut(l.id, l.pass_badge_no)}
                      className="flex-shrink-0 rounded-lg bg-emerald-600/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 transition"
                    >
                      Check-Out
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Recent check-outs ── */}
        {logs.filter((l) => l.status === 'checked_out').length > 0 && (
          <div className={`${CARD} p-5`}>
            <h2 className="mb-3 text-base font-bold text-slate-300">Recent Check-Outs</h2>
            <div className="space-y-1.5">
              {logs.filter((l) => l.status === 'checked_out').slice(0, 5).map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="font-mono text-xs text-slate-500">{l.pass_badge_no}</span>
                  <span className="text-white">{l.full_name}</span>
                  <span className="ml-auto text-xs">{new Date(l.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Handover / End shift modal ── */}
      {handoverOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 ${CARD}`}>
            <h3 className="mb-1 text-lg font-bold">End Shift Handover</h3>
            {insideLogs.length > 0 && (
              <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-900/20 px-3 py-2 text-sm text-amber-300">
                ⚠️ {insideLogs.length} visitor(s) still inside. Add handover note.
              </div>
            )}
            <label className={LABEL}>Handover Notes</label>
            <textarea rows={3} value={handoverNote} onChange={(e) => setHandoverNote(e.target.value)}
              placeholder="Any outstanding issues, visitors still on property, etc."
              className={`${INPUT} resize-none mb-4`} />
            <div className="flex gap-2">
              <button onClick={handleEndShift} disabled={endingShift} className={`${BTN_PRI} flex-1 py-2.5 text-sm`}>
                {endingShift ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Confirm End Shift
              </button>
              <button onClick={() => setHandoverOpen(false)} className={`${BTN_SEC} px-4 py-2.5 text-sm`}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   GUARD PAGE  (state machine orchestrator)
══════════════════════════════════════════════════════════════ */
export default function GuardPage({ notify }) {
  const [guardSession, setGuardSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('guard_session') || 'null'); } catch { return null; }
  });
  const [activeShift, setActiveShift] = useState(() => {
    try { return JSON.parse(localStorage.getItem('active_hotel_shift') || 'null'); } catch { return null; }
  });

  const handleLogin = (g) => {
    localStorage.setItem('guard_session', JSON.stringify(g));
    setGuardSession(g);
  };
  const handleStart = (s) => {
    localStorage.setItem('active_hotel_shift', JSON.stringify(s));
    setActiveShift(s);
  };
  const handleEndShift = () => {
    localStorage.removeItem('active_hotel_shift');
    setActiveShift(null);
  };
  const handleLogout = () => {
    localStorage.removeItem('guard_session');
    localStorage.removeItem('active_hotel_shift');
    setGuardSession(null); setActiveShift(null);
  };

  if (!guardSession) return <GuardLogin onLogin={handleLogin} notify={notify} />;
  if (!activeShift)  return <ShiftStart guard={guardSession} onStart={handleStart} onLogout={handleLogout} notify={notify} />;
  return <GuardTerminal guard={guardSession} shift={activeShift} onEndShift={handleEndShift} onLogout={handleLogout} notify={notify} />;
}
