import { useState, useRef, useCallback, useEffect } from 'react';
import { Nfc, Radio, AlertTriangle, CheckCircle2, Loader2, Trash2, Smartphone, PenLine, Eraser } from 'lucide-react';

/*
  NFC tag test screen  —  /nfc-test
  ---------------------------------
  Step 1 of the NFC visitor-tag work: confirm the phone + tags actually read.
  Uses the Web NFC API (NDEFReader), which is Android-Chrome only and needs
  HTTPS. When a tag is tapped it shows the tag's serial number (the unique ID
  we'll later map to a pass) plus any data already written on the tag.
*/

const CARD = 'bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40';
const BTN_PRI = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-900/40 disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SEC = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 font-medium text-slate-300 hover:bg-white/10 hover:text-white transition disabled:opacity-40';

function decodeRecord(record) {
  try {
    if (record.recordType === 'text') {
      const dec = new TextDecoder(record.encoding || 'utf-8');
      return { type: 'Text', value: dec.decode(record.data) };
    }
    if (record.recordType === 'url' || record.recordType === 'absolute-url') {
      return { type: 'URL', value: new TextDecoder().decode(record.data) };
    }
    if (record.recordType === 'mime') {
      return { type: record.mediaType || 'MIME', value: '(binary data)' };
    }
    return { type: record.recordType || 'unknown', value: '(binary data)' };
  } catch {
    return { type: record.recordType || 'unknown', value: '(could not decode)' };
  }
}

export default function NfcTestPage({ notify }) {
  const supported = typeof window !== 'undefined' && 'NDEFReader' in window;
  const [scanning, setScanning] = useState(false);
  const [reads, setReads] = useState([]);
  const abortRef = useRef(null);
  const [writeValue, setWriteValue] = useState('PASS-14');
  const [writing, setWriting] = useState(false);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setScanning(false);
  }, []);

  // Clean up the scan if the guard leaves the screen.
  useEffect(() => () => stop(), [stop]);

  const start = useCallback(async () => {
    if (!supported) return;
    try {
      const reader = new window.NDEFReader();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      reader.onreading = (event) => {
        const records = [];
        try {
          for (const record of event.message.records) records.push(decodeRecord(record));
        } catch { /* some tags carry no readable NDEF payload */ }
        setReads((prev) => [
          {
            id: Math.random().toString(36).slice(2),
            serial: event.serialNumber || '(no serial reported)',
            records,
            at: new Date(),
          },
          ...prev,
        ].slice(0, 30));
        if (notify) notify('Tag read ✓', 'success');
      };

      reader.onreadingerror = () => {
        if (notify) notify('Could not read that tag — try tapping again', 'error');
      };

      await reader.scan({ signal: ctrl.signal });
      setScanning(true);
      if (notify) notify('Ready — hold a tag to the back of the phone', 'info');
    } catch (err) {
      abortRef.current = null;
      setScanning(false);
      const msg = err && err.name === 'NotAllowedError'
        ? 'NFC permission was blocked. Allow it in the browser prompt and try again.'
        : `Could not start NFC: ${err?.message || err}`;
      if (notify) notify(msg, 'error');
    }
  }, [supported, notify]);

  // Write a text label onto the tag (e.g. "PASS-14"). The promise resolves
  // once a tag is tapped and written. The factory serial number is NOT
  // changed by this — only the data stored on the tag.
  const writeTag = useCallback(async () => {
    if (!supported || writing) return;
    const value = writeValue.trim();
    if (!value) { if (notify) notify('Type a label to write first', 'error'); return; }
    setWriting(true);
    if (notify) notify('Hold the tag to the phone to write…', 'info');
    try {
      const writer = new window.NDEFReader();
      await writer.write({ records: [{ recordType: 'text', data: value }] });
      if (notify) notify(`Written "${value}" to the tag ✓`, 'success');
    } catch (err) {
      const msg = err && err.name === 'NotAllowedError'
        ? 'NFC permission was blocked. Allow it and try again.'
        : `Write failed: ${err?.message || err}`;
      if (notify) notify(msg, 'error');
    } finally {
      setWriting(false);
    }
  }, [supported, writing, writeValue, notify]);

  // Erase the tag's stored data (removes the old YouTube link, etc.).
  const eraseTag = useCallback(async () => {
    if (!supported || writing) return;
    setWriting(true);
    if (notify) notify('Hold the tag to the phone to erase…', 'info');
    try {
      const writer = new window.NDEFReader();
      await writer.write({ records: [{ recordType: 'empty' }] });
      if (notify) notify('Tag erased ✓', 'success');
    } catch (err) {
      const msg = err && err.name === 'NotAllowedError'
        ? 'NFC permission was blocked. Allow it and try again.'
        : `Erase failed: ${err?.message || err}`;
      if (notify) notify(msg, 'error');
    } finally {
      setWriting(false);
    }
  }, [supported, writing, notify]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[400px] w-[400px] rounded-full bg-indigo-600/10 blur-[80px]" />
      <div className="relative mx-auto w-full max-w-lg px-4 py-8">

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-900/40">
            <Nfc className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Diagnostic</p>
            <h1 className="text-xl font-bold">NFC Tag Test</h1>
          </div>
        </div>

        {!supported ? (
          <div className={`${CARD} p-6`}>
            <div className="mb-3 flex items-center gap-2 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="text-base font-bold">NFC is not available on this device</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              Web NFC only works in <b>Google Chrome on an Android phone or tablet</b>, over HTTPS.
              It is not supported on iPhone / iPad, or on laptops and desktops.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li className="flex gap-2"><Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" /> Open this page on an Android phone in Chrome.</li>
              <li className="flex gap-2"><Radio className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" /> Make sure NFC is turned on in the phone's settings.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" /> Use the live https:// site (not a local preview).</li>
            </ul>
          </div>
        ) : (
          <>
            <div className={`${CARD} p-6`}>
              <p className="text-sm leading-relaxed text-slate-300">
                Tap <b>Start scanning</b>, allow NFC when the browser asks, then hold a visitor
                tag to the back of the phone. Each tap shows the tag's unique serial number.
              </p>
              <div className="mt-5 flex gap-3">
                {!scanning ? (
                  <button onClick={start} className={`${BTN_PRI} flex-1 py-3 text-sm`}>
                    <Radio className="h-4 w-4" /> Start scanning
                  </button>
                ) : (
                  <button onClick={stop} className={`${BTN_SEC} flex-1 py-3 text-sm`}>
                    <Loader2 className="h-4 w-4 animate-spin" /> Scanning — tap a tag (Stop)
                  </button>
                )}
                {reads.length > 0 && (
                  <button onClick={() => setReads([])} className={`${BTN_SEC} px-4 py-3 text-sm`} title="Clear list">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Optional: write a pass label onto the tag, or erase old data */}
            <div className={`${CARD} mt-5 p-6`}>
              <div className="mb-2 flex items-center gap-2 text-slate-200">
                <PenLine className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-bold">Write / erase tag (optional)</h2>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                Not required — the app identifies a tag by its fixed serial number.
                Use this only to put a label on the tag, or to wipe the old YouTube link.
                The serial number never changes.
              </p>
              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Label to write</label>
              <input
                value={writeValue}
                onChange={(e) => setWriteValue(e.target.value)}
                placeholder="e.g. PASS-14"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
              />
              <div className="mt-4 flex gap-3">
                <button onClick={writeTag} disabled={writing} className={`${BTN_PRI} flex-1 py-3 text-sm`}>
                  {writing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                  Write to tag
                </button>
                <button onClick={eraseTag} disabled={writing} className={`${BTN_SEC} px-4 py-3 text-sm`}>
                  <Eraser className="h-4 w-4" /> Erase
                </button>
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                After pressing, hold the tag to the back of the phone until you see a confirmation.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {reads.length === 0 ? (
                <p className="px-1 text-center text-xs text-slate-500">
                  {scanning ? 'Waiting for a tag…' : 'No tags read yet.'}
                </p>
              ) : (
                reads.map((r, i) => (
                  <div key={r.id} className={`${CARD} p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">
                          Tag {reads.length - i}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {r.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <div className="mt-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Serial number (tag ID)</p>
                      <p className="mt-0.5 break-all font-mono text-sm text-white">{r.serial}</p>
                    </div>
                    {r.records.length > 0 && (
                      <div className="mt-3 border-t border-white/5 pt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Data on tag</p>
                        {r.records.map((rec, k) => (
                          <p key={k} className="mt-1 break-all text-sm text-slate-200">
                            <span className="text-slate-500">{rec.type}:</span> {rec.value}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
