import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import {
  Shield, Truck, Wrench, Users, UserCheck, Search,
  LogOut, AlertTriangle, Download, Smartphone, Camera, X, ScanLine,
  Mail, Lock, LogIn, Loader2, CheckCircle2, AlertCircle, Info, Clock,
  UserPlus, Ban, ShieldCheck,
} from 'lucide-react';

/* ---------- design tokens (Tailwind class fragments) ---------- */
const CARD = 'bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40';
const INPUT =
  'w-full bg-slate-950/70 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white ' +
  'placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/60 transition';
const LABEL = 'block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5';
const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all ' +
  'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 ' +
  'shadow-lg shadow-indigo-900/40 disabled:opacity-50 disabled:cursor-not-allowed';

const TRAFFIC_TYPES = [
  { id: 'supplier_delivery', label: 'Supplier / Truck', icon: Truck, hours: 0.75 },
  { id: 'contractor_engineer', label: 'Contractor', icon: Wrench, hours: 4.0 },
  { id: 'casual_staff_banquet', label: 'Banquet Casual', icon: Users, hours: 9.0 },
  { id: 'hotel_guest_visitor', label: 'Guest Visitor', icon: UserCheck, hours: 2.0 },
];
const GATE_OPTIONS = [
  'Loading Bay / BOH Gate',
  'Main Lobby Concierge',
  'Staff Time Office',
  'Contractor West Gate',
];

/* =====================================================================
 *  Toast notifications
 * ===================================================================== */
function ToastStack({ toasts, dismiss }) {
  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
  const tones = {
    success: 'border-emerald-500/40 bg-emerald-950/80 text-emerald-200',
    error: 'border-red-500/40 bg-red-950/80 text-red-200',
    info: 'border-indigo-500/40 bg-indigo-950/80 text-indigo-200',
  };
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icons[t.type] || Info;
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${tones[t.type] || tones.info}`}
          >
            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-current/70 hover:text-current">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* =====================================================================
 *  Auth screen (Supabase email + password)
 * ===================================================================== */
function AuthScreen({ notify }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return notify('Enter email and password', 'error');
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) notify(error.message, 'error');
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) notify(error.message, 'error');
        else if (data.session) notify('Account created. You are signed in.', 'success');
        else notify('Account created. Check your email to confirm, then sign in.', 'success');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className={`w-full max-w-md p-8 ${CARD}`}>
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 p-3 shadow-lg shadow-indigo-900/50">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Hotel Security Terminal</h1>
              <p className="text-sm text-slate-400">
                {mode === 'signin' ? 'Sign in to start your shift' : 'Create a guard account'}
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className={LABEL}>Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="guard@hotel.com"
                  className={`${INPUT} pl-9`}
                />
              </div>
            </div>
            <div>
              <label className={LABEL}>Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${INPUT} pl-9`}
                />
              </div>
            </div>

            <button type="submit" disabled={busy} className={`${BTN_PRIMARY} w-full py-3`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            {mode === 'signin' ? "No account yet?" : 'Already have an account?'}{' '}
            <button
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="font-semibold text-indigo-400 hover:text-indigo-300"
            >
              {mode === 'signin' ? 'Create one' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
 *  Main application
 * ===================================================================== */
export default function App() {
  // Auth
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState([]);
  const notify = useCallback((message, type = 'info') => {
    const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);
  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // Shift + data
  const [activeShift, setActiveShift] = useState(null);
  const [guardNameInput, setGuardNameInput] = useState('');
  const [gateLocation, setGateLocation] = useState(GATE_OPTIONS[0]);
  const [viewMode, setViewMode] = useState('guard');
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState('');
  const [logSearch, setLogSearch] = useState('');

  // Check-in form
  const [fullName, setFullName] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [trafficType, setTrafficType] = useState('supplier_delivery');
  const [purpose, setPurpose] = useState('');
  const [hostDept, setHostDept] = useState('');
  const [passBadgeNo, setPassBadgeNo] = useState('');
  const [allowedHours, setAllowedHours] = useState(0.75);
  const [statusMsg, setStatusMsg] = useState('');
  const [nationality, setNationality] = useState('');
  const [idExpiryDate, setIdExpiryDate] = useState('');
  const [isIdExpired, setIsIdExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Manager / guard accounts
  const [myRole, setMyRole] = useState(null);
  const [guards, setGuards] = useState([]);
  const [guardsLoading, setGuardsLoading] = useState(false);
  const [newGuardName, setNewGuardName] = useState('');
  const [newGuardEmail, setNewGuardEmail] = useState('');
  const [newGuardPassword, setNewGuardPassword] = useState('');
  const [guardBusy, setGuardBusy] = useState(false);

  // Scanner
  const [showDocumentScanner, setShowDocumentScanner] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [scannerMsg, setScannerMsg] = useState('');
  const videoRef = useRef(null);
  const scannerCanvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const scanLoopRef = useRef(null);
  const scanBusyRef = useRef(false);
  const barcodeReaderRef = useRef(null);
  const barcodeDetectorRef = useRef(null);
  const apiScanBusyRef = useRef(false);
  const lookupRequestRef = useRef(0);
  const preserveScanFieldsRef = useRef(false);

  /* ---------------- Auth lifecycle ---------------- */
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setAuthReady(true);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const fetchActiveLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from('hotel_security_logs')
      .select('*')
      .order('check_in_time', { ascending: false });
    if (!error && data) setLogs(data);
    setLogsLoading(false);
  }, []);

  /* ---------------- Data lifecycle (only when signed in) ---------------- */
  useEffect(() => {
    if (!session) return undefined;
    const savedShift = localStorage.getItem('active_hotel_shift');
    if (savedShift) {
      try { setActiveShift(JSON.parse(savedShift)); } catch { /* ignore corrupt cache */ }
    }
    setLogsLoading(true);
    fetchActiveLogs();

    const subscription = supabase
      .channel('hotel_logs_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hotel_security_logs' }, () => {
        fetchActiveLogs();
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [session, fetchActiveLogs]);

  // Detect whether the signed-in user is a manager.
  useEffect(() => {
    if (!session) { setMyRole(null); return; }
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        const role = data?.role || 'guard';
        setMyRole(role);
        // Guards may only ever see the check-in terminal.
        if (role !== 'manager') setViewMode('guard');
      });
  }, [session]);

  useEffect(() => {
    const match = TRAFFIC_TYPES.find((t) => t.id === trafficType);
    if (match) setAllowedHours(match.hours);
  }, [trafficType]);

  /* ---------------- Guard account management (managers only) ---------------- */
  const loadGuards = useCallback(async () => {
    setGuardsLoading(true);
    const { data, error } = await supabase.functions.invoke('manage-guards', { body: { action: 'list' } });
    if (error || !data?.success) notify(error?.message || data?.error || 'Failed to load guard accounts', 'error');
    else setGuards(data.users);
    setGuardsLoading(false);
  }, [notify]);

  useEffect(() => {
    if (viewMode === 'manager' && myRole === 'manager') loadGuards();
  }, [viewMode, myRole, loadGuards]);

  const createGuard = async (e) => {
    e.preventDefault();
    if (!newGuardEmail.trim() || newGuardPassword.length < 6) {
      return notify('Email and a password of 6+ characters are required', 'error');
    }
    setGuardBusy(true);
    const { data, error } = await supabase.functions.invoke('manage-guards', {
      body: { action: 'create', email: newGuardEmail.trim(), password: newGuardPassword, full_name: newGuardName.trim() },
    });
    setGuardBusy(false);
    if (error || !data?.success) return notify(error?.message || data?.error || 'Could not create account', 'error');
    notify('Guard account created', 'success');
    setNewGuardName(''); setNewGuardEmail(''); setNewGuardPassword('');
    loadGuards();
  };

  const toggleGuardDisabled = async (g) => {
    const { data, error } = await supabase.functions.invoke('manage-guards', {
      body: { action: 'set_disabled', user_id: g.id, disabled: !g.disabled },
    });
    if (error || !data?.success) return notify(error?.message || data?.error || 'Update failed', 'error');
    notify(g.disabled ? 'Account re-enabled' : 'Account disabled', 'success');
    loadGuards();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('active_hotel_shift');
    setActiveShift(null);
    setLogs([]);
    notify('Signed out', 'info');
  };

  /* ---------------- Shift ---------------- */
  const handleStartShift = async (e) => {
    e.preventDefault();
    if (!guardNameInput.trim()) return notify('Please enter guard name', 'error');

    const { data, error } = await supabase
      .from('guard_shifts')
      .insert([{ guard_name: guardNameInput.trim(), gate_location: gateLocation, status: 'active' }])
      .select()
      .single();

    if (error) return notify(error.message, 'error');
    setActiveShift(data);
    localStorage.setItem('active_hotel_shift', JSON.stringify(data));
    notify(`Shift started at ${data.gate_location}`, 'success');
  };

  const startNfcScan = async () => {
    if ('NDEFReader' in window) {
      try {
        const ndef = new window.NDEFReader();
        await ndef.scan();
        setStatusMsg('NFC Ready: Tap badge to back of phone');
        ndef.onreading = (event) => {
          const serial = event.serialNumber.replace(/:/g, '').toUpperCase();
          setPassBadgeNo(serial);
          setStatusMsg(`Badge Scanned: ${serial}`);
          notify(`Badge scanned: ${serial}`, 'success');
        };
      } catch (err) {
        setStatusMsg('NFC Error: ' + err.message);
        notify('NFC error: ' + err.message, 'error');
      }
    } else {
      notify('Web NFC is available on Android Chrome only', 'info');
    }
  };

  /* ---------------- Autofill ---------------- */
  const expiryIsPast = (value) => {
    if (!value) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(`${value}T00:00:00`) < today;
  };

  const clearAutofillFields = () => {
    setFullName('');
    setMobileNumber('');
    setCompanyName('');
    setVehiclePlate('');
    setHostDept('');
    setNationality('');
    setIdExpiryDate('');
    setIsIdExpired(false);
  };

  const applyVisitorMatch = (match) => {
    setFullName(match.full_name || '');
    setMobileNumber(match.mobile_number || '');
    setCompanyName(match.company_name || '');
    setVehiclePlate(match.vehicle_plate || '');
    setHostDept(match.host_room_or_dept || '');
    setNationality(match.nationality || '');
    const matchedExpiry = match.id_expiry_date || match.expiry_date || '';
    setIdExpiryDate(matchedExpiry);
    setIsIdExpired(expiryIsPast(matchedExpiry));
  };

  const handleDocSearch = (val) => {
    setDocNumber(val);
    if (val.trim().length < 4) {
      clearAutofillFields();
      return;
    }
    const localMatch = logs.find((log) =>
      [log.doc_number, log.mobile_number, log.vehicle_plate]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(val.trim().toLowerCase()))
    );
    if (localMatch) applyVisitorMatch(localMatch);
  };

  useEffect(() => {
    const query = docNumber.trim();
    if (query.length < 4) return undefined;

    const requestId = ++lookupRequestRef.current;
    const timer = setTimeout(async () => {
      const safeQuery = query.replace(/[^a-zA-Z0-9]/g, '');
      if (!safeQuery) return;
      const { data, error } = await supabase
        .from('hotel_security_logs')
        .select('full_name, mobile_number, company_name, vehicle_plate, host_room_or_dept, nationality, id_expiry_date, doc_number')
        .or(`doc_number.ilike.%${safeQuery}%,mobile_number.ilike.%${safeQuery}%,vehicle_plate.ilike.%${safeQuery}%`)
        .order('check_in_time', { ascending: false })
        .limit(1);

      if (requestId !== lookupRequestRef.current) return;
      if (error || !data?.[0]) {
        if (preserveScanFieldsRef.current) {
          preserveScanFieldsRef.current = false;
          return;
        }
        clearAutofillFields();
      } else {
        preserveScanFieldsRef.current = false;
        applyVisitorMatch(data[0]);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [docNumber]);

  /* ---------------- Document scanner (camera + OCR) ---------------- */
  const stopDocumentScanner = () => {
    scanLoopRef.current = null;
    scanBusyRef.current = false;
    barcodeReaderRef.current?.reset();
    barcodeReaderRef.current = null;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => () => stopDocumentScanner(), []);

  const closeDocumentScanner = () => {
    stopDocumentScanner();
    setShowDocumentScanner(false);
    setIsScanning(false);
    setCameraReady(false);
    setScannerMsg('');
  };

  const openDocumentScanner = async () => {
    setShowDocumentScanner(true);
    setScannerMsg('Requesting camera access...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setCameraReady(true);
      setIsScanning(true);
      setScannerMsg('Live scan active: align an Emirates ID barcode or passport MRZ.');
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          startLiveScanner();
        }
      });
    } catch (error) {
      setCameraReady(false);
      setScannerMsg(`Camera unavailable: ${error.message}`);
      notify(`Camera unavailable: ${error.message}`, 'error');
    }
  };

  const parseBarcodePayload = (text) => {
    const lines = text.split(/[\r\n|;]/).map((line) => line.trim()).filter(Boolean);
    const findValue = (labels) => {
      const line = lines.find((value) => labels.some((label) => value.toLowerCase().includes(label)));
      return line ? line.split(/[:=]/).slice(1).join(':').trim() : '';
    };
    const documentNumber =
      findValue(['id number', 'identity number', 'document number']) ||
      text.match(/784-?\d{4}-?\d{7}-?\d/)?.[0] ||
      text.match(/\b\d{15}\b/)?.[0] ||
      '';
    const expiry = findValue(['expiry', 'expiration', 'date of expiry']).replace(/[^0-9]/g, '');
    const expiryDate = expiry.length === 8
      ? `${expiry.slice(4, 8)}-${expiry.slice(2, 4)}-${expiry.slice(0, 2)}`
      : '';
    return {
      documentNumber,
      fullName: findValue(['full name', 'name']),
      nationality: findValue(['nationality', 'country']),
      expiryDate,
    };
  };

  const applyScanResult = ({ documentNumber, fullName: scannedName, nationality: scannedNationality, expiryDate, docType }) => {
    if (!documentNumber && !scannedName) return;
    preserveScanFieldsRef.current = true;
    if (documentNumber) setDocNumber(documentNumber.replace(/</g, ''));
    if (scannedName) setFullName(scannedName.replace(/</g, ' ').replace(/\s+/g, ' ').trim());
    if (scannedNationality) setNationality(scannedNationality.replace(/</g, '').trim());
    if (docType === 'passport') setCompanyName('Passport');
    if (docType === 'emirates_id') setCompanyName('Emirates ID');
    if (expiryDate) setIdExpiryDate(expiryDate);
    setIsIdExpired(expiryIsPast(expiryDate));
    if ('vibrate' in navigator) navigator.vibrate(100);
    const expired = expiryIsPast(expiryDate);
    setStatusMsg(expired ? '⚠️ EXPIRED DOCUMENT' : 'Document locked successfully.');
    notify(expired ? '⚠️ Scanned document is EXPIRED' : 'Document scanned successfully', expired ? 'error' : 'success');
    closeDocumentScanner();
  };

  const scanFrameWithApi = async (sourceCanvas) => {
    if (apiScanBusyRef.current || !sourceCanvas) return;
    apiScanBusyRef.current = true;
    try {
      const image = sourceCanvas.toDataURL('image/jpeg', 0.82).split(',')[1];
      const { data, error } = await supabase.functions.invoke('scan-id', {
        body: { imageBase64: image },
      });
      if (error) throw error;
      const ext = data?.extracted;
      if (ext && (ext.docNumber || ext.fullName)) {
        applyScanResult({
          documentNumber: ext.docNumber,
          fullName: ext.fullName,
          nationality: ext.nationality,
          expiryDate: ext.expiryDate,
          docType: ext.docType,
        });
      }
    } catch (error) {
      setScannerMsg(`Secure OCR unavailable: ${error.message}`);
    } finally {
      apiScanBusyRef.current = false;
    }
  };

  const runMrzPass = async () => {
    const video = videoRef.current;
    const canvas = scannerCanvasRef.current;
    if (!video || !canvas || scanBusyRef.current) return;
    scanBusyRef.current = true;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) {
      scanBusyRef.current = false;
      return;
    }
    canvas.width = 640;
    canvas.height = 160;
    context.drawImage(video, sourceWidth * 0.1, sourceHeight * 0.75, sourceWidth * 0.8, sourceHeight * 0.25, 0, 0, 640, 160);
    const pixels = context.getImageData(0, 0, 640, 160);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const luminance = (pixels.data[index] * 0.299) + (pixels.data[index + 1] * 0.587) + (pixels.data[index + 2] * 0.114);
      const value = luminance > 145 ? 255 : 0;
      pixels.data[index] = value;
      pixels.data[index + 1] = value;
      pixels.data[index + 2] = value;
    }
    context.putImageData(pixels, 0, 0);
    await scanFrameWithApi(canvas);
    scanBusyRef.current = false;
  };

  const startLiveScanner = async () => {
    const video = videoRef.current;
    if (!video) return;
    const targetFormats = ['pdf417', 'qr_code', 'code_128'];
    if ('BarcodeDetector' in window) {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = targetFormats.filter((format) => supported.includes(format));
      if (formats.length) barcodeDetectorRef.current = new window.BarcodeDetector({ formats });
    }
    if (!barcodeDetectorRef.current) {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417, BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128]);
      barcodeReaderRef.current = new BrowserMultiFormatReader(hints);
    }
    let lastMrzPass = 0;
    const loop = async (timestamp) => {
      if (!cameraStreamRef.current || !video.videoWidth) return;
      try {
        const nativeResults = barcodeDetectorRef.current ? await barcodeDetectorRef.current.detect(video) : [];
        if (nativeResults.length) {
          applyScanResult(parseBarcodePayload(nativeResults[0].rawValue));
          const barcodeCanvas = document.createElement('canvas');
          barcodeCanvas.width = 1280;
          barcodeCanvas.height = 720;
          barcodeCanvas.getContext('2d').drawImage(video, 0, 0, 1280, 720);
          await scanFrameWithApi(barcodeCanvas);
          return;
        }
        if (barcodeReaderRef.current && scannerCanvasRef.current) {
          const canvas = scannerCanvasRef.current;
          canvas.width = 640;
          canvas.height = 360;
          canvas.getContext('2d').drawImage(video, 0, 0, 640, 360);
          try {
            const result = barcodeReaderRef.current.decodeFromCanvas(canvas);
            if (result) {
              applyScanResult(parseBarcodePayload(result.getText()));
              await scanFrameWithApi(canvas);
              return;
            }
          } catch {
            // No barcode in this frame; continue with the live loop.
          }
        }
        if (timestamp - lastMrzPass > 350) {
          lastMrzPass = timestamp;
          runMrzPass();
        }
      } catch (error) {
        setScannerMsg(`Live scan error: ${error.message}`);
      }
      scanLoopRef.current = requestAnimationFrame(loop);
    };
    scanLoopRef.current = requestAnimationFrame(loop);
  };

  /* ---------------- Check-in / out ---------------- */
  const resetForm = () => {
    setFullName('');
    setDocNumber('');
    setMobileNumber('');
    setCompanyName('');
    setVehiclePlate('');
    setPurpose('');
    setHostDept('');
    setPassBadgeNo('');
    setNationality('');
    setIdExpiryDate('');
    setIsIdExpired(false);
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    if (!passBadgeNo || !fullName || !docNumber) {
      return notify('Fill name, document, and assign a pass badge', 'error');
    }
    setSubmitting(true);
    const { error } = await supabase.from('hotel_security_logs').insert([{
      shift_id: activeShift?.id || null,
      logged_by_guard: activeShift?.guard_name || 'Terminal Guard',
      full_name: fullName,
      doc_number: docNumber,
      mobile_number: mobileNumber,
      company_name: companyName,
      vehicle_plate: vehiclePlate,
      nationality,
      id_expiry_date: idExpiryDate || null,
      traffic_type: trafficType,
      purpose_of_visit: purpose || 'Standard Entry',
      host_room_or_dept: hostDept || 'General BOH',
      pass_badge_no: passBadgeNo,
      allowed_hours: allowedHours,
      status: 'inside',
    }]);
    setSubmitting(false);

    if (error) {
      notify(error.message, 'error');
    } else {
      resetForm();
      setStatusMsg('Check-In Successful!');
      notify('Check-in logged & pass issued', 'success');
      fetchActiveLogs();
    }
  };

  const handleCheckOut = async (id, badgeNo) => {
    const { error } = await supabase
      .from('hotel_security_logs')
      .update({
        status: 'checked_out',
        check_out_time: new Date().toISOString(),
        checkout_by_guard: activeShift?.guard_name || 'Terminal Guard',
      })
      .eq('id', id);

    if (error) notify(error.message, 'error');
    else {
      setStatusMsg(`Pass #${badgeNo} Checked Out`);
      notify(`Pass #${badgeNo} checked out`, 'success');
      fetchActiveLogs();
    }
  };

  const exportToExcel = () => {
    const formatted = logs.map((l) => ({
      'Pass Badge': l.pass_badge_no,
      'Full Name': l.full_name,
      Company: l.company_name,
      'Vehicle Plate': l.vehicle_plate,
      Nationality: l.nationality,
      'ID Expiry Date': l.id_expiry_date || '',
      'Traffic Type': l.traffic_type,
      Destination: l.host_room_or_dept,
      Status: l.status,
      'Check-In Time': l.check_in_time ? new Date(l.check_in_time).toLocaleString() : '',
      'Check-Out Time': l.check_out_time ? new Date(l.check_out_time).toLocaleString() : 'Still Inside',
      'Logged By Guard': l.logged_by_guard,
      'Checked Out By': l.checkout_by_guard || '-',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(formatted);
    XLSX.utils.book_append_sheet(wb, ws, 'Visitor & Contractor Logs');
    XLSX.writeFile(wb, `Hotel_Security_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify('Excel report downloaded', 'success');
  };

  const insideLogs = logs.filter((l) => l.status === 'inside');
  const now = new Date();
  const overstayCount = insideLogs.filter((l) => (now - new Date(l.check_in_time)) / 3600000 > l.allowed_hours).length;

  const handleEndShift = async () => {
    if (!activeShift) return;
    const overstays = insideLogs.filter((l) => (now - new Date(l.check_in_time)) / 3600000 > l.allowed_hours);

    const handoverText = `*HOTEL SECURITY SHIFT HANDOVER REPORT*
*Gate:* ${activeShift.gate_location}
*Duty Guard:* ${activeShift.guard_name}
*Shift Window:* ${activeShift.start_time ? new Date(activeShift.start_time).toLocaleTimeString() : '-'} - ${new Date().toLocaleTimeString()}

*TOTAL PROCESSED:* ${logs.length}
*UNRETURNED PASSES INSIDE:* ${insideLogs.length}
${insideLogs.map((b) => `• Pass #${b.pass_badge_no}: ${b.full_name} (${b.host_room_or_dept})`).join('\n')}

*ACTIVE OVERSTAYS:* ${overstays.length}
${overstays.map((o) => `• ⚠️ Pass #${o.pass_badge_no}: ${o.full_name} (${o.company_name || 'Visitor'})`).join('\n')}

*NOTES:* ${handoverNotes || 'All operations normal.'}`;

    try {
      await navigator.clipboard.writeText(handoverText);
      notify('Handover summary copied for WhatsApp', 'success');
    } catch {
      notify('Could not access clipboard', 'error');
    }

    await supabase.from('guard_shifts').update({
      end_time: new Date().toISOString(),
      status: 'completed',
      handover_notes: handoverNotes,
    }).eq('id', activeShift.id);

    localStorage.removeItem('active_hotel_shift');
    setActiveShift(null);
    setShowHandoverModal(false);
  };

  /* ---------------- Render gates ---------------- */
  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <ToastStack toasts={toasts} dismiss={dismissToast} />
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <AuthScreen notify={notify} />
        <ToastStack toasts={toasts} dismiss={dismissToast} />
      </>
    );
  }

  if (!activeShift) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
        <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative flex min-h-screen items-center justify-center p-4">
          <div className={`w-full max-w-md p-8 ${CARD}`}>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 p-3 shadow-lg shadow-indigo-900/50">
                  <Shield className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">Start Duty Shift</h1>
                  <p className="text-sm text-slate-400">{session.user?.email}</p>
                </div>
              </div>
              <button onClick={handleSignOut} title="Sign out" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white">
                <LogOut className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleStartShift} className="space-y-4">
              <div>
                <label className={LABEL}>Duty Guard Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Officer Satnam"
                  value={guardNameInput}
                  onChange={(e) => setGuardNameInput(e.target.value)}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Gate Location</label>
                <select value={gateLocation} onChange={(e) => setGateLocation(e.target.value)} className={INPUT}>
                  {GATE_OPTIONS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <button type="submit" className={`${BTN_PRIMARY} w-full py-3.5`}>Start Duty Shift</button>
            </form>
          </div>
        </div>
        <ToastStack toasts={toasts} dismiss={dismissToast} />
      </div>
    );
  }

  /* ---------------- Main terminal ---------------- */
  const filteredLogs = logSearch.trim()
    ? logs.filter((l) => {
        const q = logSearch.trim().toLowerCase();
        return [l.full_name, l.company_name, l.doc_number, l.vehicle_plate, l.pass_badge_no, l.mobile_number]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
    : logs;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100 pb-12 font-sans">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 p-2 shadow-lg shadow-indigo-900/50">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight">{activeShift.gate_location}</div>
              <div className="text-xs text-slate-400">
                On Duty: <span className="font-medium text-indigo-400">{activeShift.guard_name}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {myRole === 'manager' && (
              <button
                onClick={() => setViewMode(viewMode === 'guard' ? 'manager' : 'guard')}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10"
              >
                {viewMode === 'guard' ? 'Manager View' : 'Guard View'}
              </button>
            )}
            <button
              onClick={() => setShowHandoverModal(true)}
              className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-600/20 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-600/30"
            >
              <LogOut className="h-3.5 w-3.5" /> End Shift
            </button>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4">
        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Inside Now', value: insideLogs.length, tone: 'text-indigo-400' },
            { label: 'Overstay Alerts', value: overstayCount, tone: 'text-red-400' },
            { label: 'Total Processed', value: logs.length, tone: 'text-emerald-400' },
          ].map((s) => (
            <div key={s.label} className={`${CARD} p-3`}>
              <div className="text-xs font-medium text-slate-400">{s.label}</div>
              <div className={`mt-1 text-2xl font-bold ${s.tone}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {viewMode === 'guard' && (
          <>
            {/* Check-in */}
            <div className={`${CARD} p-5`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <UserCheck className="h-5 w-5 text-indigo-400" /> Fast Pass Check-In
                </h2>
                <button
                  type="button"
                  onClick={openDocumentScanner}
                  className="flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-600/20 px-3 py-2 text-xs font-bold text-indigo-300 transition hover:bg-indigo-600/30"
                >
                  <Camera className="h-4 w-4" /> Scan Document
                </button>
              </div>

              {showDocumentScanner && (
                <div className="mb-4 space-y-3 rounded-xl border border-indigo-500/30 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                      <ScanLine className="h-4 w-4" /> Passport / Emirates ID MRZ Scanner
                    </div>
                    <button type="button" onClick={closeDocumentScanner} className="text-slate-400 hover:text-white" title="Close scanner">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                    <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                    <div className={`pointer-events-none absolute inset-x-[10%] bottom-[5%] h-[25%] rounded-lg border-2 border-cyan-300 ${isScanning ? 'animate-pulse shadow-[0_0_18px_rgba(103,232,249,0.9)]' : ''}`} />
                    <div className="pointer-events-none absolute bottom-[7%] left-[12%] right-[12%] border-t border-cyan-200/70" />
                  </div>
                  <canvas ref={scannerCanvasRef} width="640" height="160" className="hidden" />
                  <p className="text-xs text-slate-400">{scannerMsg || (cameraReady ? 'Live scan active...' : 'Starting camera...')}</p>
                </div>
              )}

              <form onSubmit={handleCheckIn} className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TRAFFIC_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTrafficType(t.id)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                        trafficType === t.id
                          ? 'border-indigo-500 bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-md'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <t.icon className="h-4 w-4" /> {t.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={LABEL}>Doc # / Plate / Mobile (Auto-Match)</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="784-1985... or Plate #"
                        value={docNumber}
                        onChange={(e) => handleDocSearch(e.target.value)}
                        className={`${INPUT} pr-9`}
                      />
                      <Search className="absolute right-3 top-3 h-4 w-4 text-slate-500" />
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">Enter any 4 digits from document, mobile, or plate for history autofill.</div>
                  </div>

                  <div>
                    <label className={LABEL}>Full Name</label>
                    <input type="text" required placeholder="Driver / Visitor Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={INPUT} />
                  </div>

                  <div>
                    <label className={LABEL}>Company / Supplier</label>
                    <input type="text" placeholder="e.g. Al Rawabi, Otis, Farnek" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={INPUT} />
                  </div>

                  <div>
                    <label className={LABEL}>Mobile Number</label>
                    <input type="tel" placeholder="05x xxx xxxx" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className={INPUT} />
                  </div>

                  <div>
                    <label className={LABEL}>Vehicle Plate (Optional)</label>
                    <input type="text" placeholder="e.g. DXB A 45892" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} className={INPUT} />
                  </div>

                  <div>
                    <label className={LABEL}>Nationality</label>
                    <input type="text" placeholder="From MRZ scan" value={nationality} onChange={(e) => setNationality(e.target.value.toUpperCase())} className={INPUT} />
                  </div>

                  <div>
                    <label className={LABEL}>Document Expiry</label>
                    <input
                      type="date"
                      value={idExpiryDate}
                      onChange={(e) => { setIdExpiryDate(e.target.value); setIsIdExpired(expiryIsPast(e.target.value)); }}
                      className={`${INPUT} ${expiryIsPast(idExpiryDate) ? '!border-red-500' : ''}`}
                    />
                    {isIdExpired && (
                      <div className="mt-1 inline-flex animate-pulse items-center rounded-md border border-red-500/60 bg-red-600/20 px-2 py-1 text-xs font-bold text-red-300">
                        ⚠️ EXPIRED
                      </div>
                    )}
                  </div>

                  <div>
                    <label className={LABEL}>Destination / Department</label>
                    <input type="text" placeholder="e.g. Main Kitchen, Plant Room" value={hostDept} onChange={(e) => setHostDept(e.target.value)} className={INPUT} />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={LABEL}>NFC Badge / Physical Pass #</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Pass # or NFC Tap"
                        value={passBadgeNo}
                        onChange={(e) => setPassBadgeNo(e.target.value)}
                        className={`${INPUT} font-mono`}
                      />
                      <button
                        type="button"
                        onClick={startNfcScan}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 text-indigo-400 transition hover:bg-white/10"
                        title="Scan NFC Badge"
                      >
                        <Smartphone className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {statusMsg && <div className="font-mono text-xs text-indigo-400">{statusMsg}</div>}

                <button type="submit" disabled={submitting} className={`${BTN_PRIMARY} w-full py-3`}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                  Confirm Check-In & Issue Pass
                </button>
              </form>
            </div>

            {/* Active passes */}
            <div className={`${CARD} space-y-3 p-5`}>
              <h2 className="flex items-center justify-between text-base font-bold">
                <span>Active On Property ({insideLogs.length})</span>
                <span className="text-xs font-normal text-slate-400">Tap ‘Check-Out’ when pass is returned</span>
              </h2>

              <div className="max-h-96 divide-y divide-white/5 overflow-y-auto">
                {logsLoading ? (
                  <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
                ) : insideLogs.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">No visitors or contractors currently inside.</div>
                ) : (
                  insideLogs.map((item) => {
                    const elapsedHours = (now - new Date(item.check_in_time)) / 3600000;
                    const isOverstay = elapsedHours > item.allowed_hours;
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-2 py-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded border border-indigo-500/40 bg-indigo-600/30 px-2 py-0.5 font-mono text-xs text-indigo-300">
                              Pass #{item.pass_badge_no}
                            </span>
                            <span className="text-sm font-bold text-white">{item.full_name}</span>
                            {item.vehicle_plate && (
                              <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-slate-300">{item.vehicle_plate}</span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {item.company_name && <span>{item.company_name} • </span>}
                            <span>Dest: {item.host_room_or_dept}</span> •{' '}
                            <span className="text-slate-500">In: {new Date(item.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {isOverstay && (
                            <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-400">
                              <AlertTriangle className="h-3.5 w-3.5" /> OVERSTAY: {elapsedHours.toFixed(1)}h (Limit: {item.allowed_hours}h)
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleCheckOut(item.id, item.pass_badge_no)}
                          className="whitespace-nowrap rounded-lg border border-emerald-500/30 bg-emerald-600/20 px-3 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-600/30"
                        >
                          Check-Out
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Recent check-outs */}
            <div className={`${CARD} space-y-3 p-5`}>
              <h2 className="text-base font-bold">Recent Check-Outs</h2>
              <div className="max-h-64 divide-y divide-white/5 overflow-y-auto">
                {logs.filter((l) => l.status === 'checked_out').slice(0, 10).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <div className="text-sm font-bold text-white">{item.full_name}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        Pass #{item.pass_badge_no} {item.company_name && <span>• {item.company_name}</span>}
                      </div>
                    </div>
                    <div className="whitespace-nowrap text-right font-mono text-xs">
                      <div className="text-emerald-400">In: {new Date(item.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="text-amber-400">Out: {item.check_out_time ? new Date(item.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                    </div>
                  </div>
                ))}
                {logs.every((l) => l.status !== 'checked_out') && (
                  <div className="py-6 text-center text-sm text-slate-500">No completed check-outs yet.</div>
                )}
              </div>
            </div>
          </>
        )}

        {viewMode === 'manager' && (
          <div className="space-y-4">
            {myRole === 'manager' && (
              <div className={`${CARD} space-y-4 p-5`}>
                <h2 className="flex items-center gap-2 text-base font-bold text-white">
                  <ShieldCheck className="h-5 w-5 text-indigo-400" /> Guard Accounts
                </h2>

                <form onSubmit={createGuard} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                  <input
                    type="text"
                    placeholder="Guard name"
                    value={newGuardName}
                    onChange={(e) => setNewGuardName(e.target.value)}
                    className={INPUT}
                  />
                  <input
                    type="email"
                    required
                    placeholder="Email"
                    value={newGuardEmail}
                    onChange={(e) => setNewGuardEmail(e.target.value)}
                    className={INPUT}
                  />
                  <input
                    type="password"
                    required
                    placeholder="Password (6+ chars)"
                    value={newGuardPassword}
                    onChange={(e) => setNewGuardPassword(e.target.value)}
                    className={INPUT}
                  />
                  <button type="submit" disabled={guardBusy} className={`${BTN_PRIMARY} py-2.5`}>
                    {guardBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    Add Guard
                  </button>
                </form>

                <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
                  {guardsLoading ? (
                    <div className="py-6 text-center text-sm text-slate-500">Loading accounts…</div>
                  ) : guards.length === 0 ? (
                    <div className="py-6 text-center text-sm text-slate-500">No accounts yet.</div>
                  ) : (
                    guards.map((g) => (
                      <div key={g.id} className="flex items-center justify-between gap-3 bg-slate-950/40 px-3 py-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-white">{g.full_name || g.email}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              g.role === 'manager' ? 'bg-indigo-600/30 text-indigo-300' : 'bg-white/5 text-slate-400'
                            }`}>
                              {g.role}
                            </span>
                            {g.disabled && (
                              <span className="rounded bg-red-600/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-300">Disabled</span>
                            )}
                          </div>
                          <div className="truncate text-xs text-slate-400">{g.email}</div>
                        </div>
                        {g.role !== 'manager' && (
                          <button
                            onClick={() => toggleGuardDisabled(g)}
                            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                              g.disabled
                                ? 'border-emerald-500/30 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
                                : 'border-red-500/30 bg-red-600/20 text-red-300 hover:bg-red-600/30'
                            }`}
                          >
                            {g.disabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                            {g.disabled ? 'Enable' : 'Disable'}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Disabling blocks login but keeps the account and its audit history. Managers can’t disable their own account.
                </p>
              </div>
            )}

            <div className={`${CARD} flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center`}>
              <div>
                <h2 className="text-base font-bold text-white">Security Audit Log & Time Tracking</h2>
                <p className="text-xs text-slate-400">All check-ins, check-outs, and duration records</p>
              </div>
              <button onClick={exportToExcel} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-emerald-500">
                <Download className="h-4 w-4" /> Export Excel Log (.xlsx)
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search name, company, document, plate, or pass #..."
                className={`${INPUT} pl-9`}
              />
            </div>

            <div className={`${CARD} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/10 bg-slate-950/60 text-slate-400">
                    <tr>
                      <th className="p-3">Pass #</th>
                      <th className="p-3">Name / Company</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Check-In</th>
                      <th className="p-3">Check-Out (Exit)</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Guard</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {filteredLogs.length === 0 ? (
                      <tr><td colSpan="8" className="p-6 text-center text-slate-500">No logs found.</td></tr>
                    ) : (
                      filteredLogs.map((l) => {
                        const inTime = l.check_in_time ? new Date(l.check_in_time) : null;
                        const outTime = l.check_out_time ? new Date(l.check_out_time) : null;
                        let durationDisplay = '-';
                        if (inTime && outTime) {
                          const diffMinutes = Math.round((outTime - inTime) / 60000);
                          durationDisplay = diffMinutes < 60 ? `${diffMinutes}m` : `${(diffMinutes / 60).toFixed(1)}h`;
                        } else if (inTime && l.status === 'inside') {
                          const diffMinutes = Math.round((now - inTime) / 60000);
                          durationDisplay = diffMinutes < 60 ? `${diffMinutes}m (Active)` : `${(diffMinutes / 60).toFixed(1)}h (Active)`;
                        }
                        return (
                          <tr key={l.id} className="transition-colors hover:bg-white/5">
                            <td className="p-3 font-mono font-bold text-indigo-400">#{l.pass_badge_no}</td>
                            <td className="p-3">
                              <div className="font-semibold text-white">{l.full_name}</div>
                              <div className="text-[11px] text-slate-400">{l.company_name || l.doc_number}</div>
                            </td>
                            <td className="p-3 text-[10px] uppercase text-slate-400">{l.traffic_type?.replace(/_/g, ' ')}</td>
                            <td className="whitespace-nowrap p-3 font-mono text-emerald-400">
                              {inTime ? inTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>
                            <td className="whitespace-nowrap p-3 font-mono text-amber-400">
                              {outTime ? outTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300">Still Inside</span>}
                            </td>
                            <td className="p-3 font-mono text-slate-300">{durationDisplay}</td>
                            <td className="p-3">
                              <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                l.status === 'inside' ? 'border border-indigo-500/40 bg-indigo-600/30 text-indigo-300' : 'bg-white/5 text-slate-400'
                              }`}>
                                {l.status === 'inside' ? 'Inside' : 'Checked Out'}
                              </span>
                            </td>
                            <td className="p-3 text-[11px] text-slate-400">
                              <div>In: {l.logged_by_guard}</div>
                              {l.checkout_by_guard && <div className="text-[10px] text-slate-500">Out: {l.checkout_by_guard}</div>}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Handover modal */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md space-y-4 p-6 ${CARD}`}>
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <Clock className="h-5 w-5 text-amber-400" /> Shift Handover Summary
            </h3>
            <p className="text-xs text-slate-400">Generate formatted WhatsApp report and close shift.</p>
            <div className="space-y-1 rounded-lg border border-white/10 bg-slate-950/60 p-3 text-xs">
              <div><b>Active Passes Inside:</b> {insideLogs.length}</div>
              <div><b>Overstay Warnings:</b> {overstayCount}</div>
            </div>
            <div>
              <label className={LABEL}>Handover Notes / Key Incidents</label>
              <textarea
                rows={3}
                placeholder="e.g. Chiller contractor still in Plant Room until 22:00..."
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowHandoverModal(false)} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/10">
                Cancel
              </button>
              <button type="button" onClick={handleEndShift} className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-2.5 text-xs font-bold text-white shadow-lg transition hover:from-red-500 hover:to-rose-500">
                Copy WhatsApp & End
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastStack toasts={toasts} dismiss={dismissToast} />
    </div>
  );
}
