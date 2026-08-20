import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import { 
  Shield, Truck, Wrench, Users, UserCheck, Search, 
  LogOut, Clock, AlertTriangle, Download, Smartphone
} from 'lucide-react';

export default function App() {
  const [activeShift, setActiveShift] = useState(null);
  const [guardNameInput, setGuardNameInput] = useState('');
  const [gateLocation, setGateLocation] = useState('Loading Bay / BOH Gate');
  const [viewMode, setViewMode] = useState('guard');
  const [logs, setLogs] = useState([]);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState('');

  // Form State
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

  useEffect(() => {
    const savedShift = localStorage.getItem('active_hotel_shift');
    if (savedShift) {
      setActiveShift(JSON.parse(savedShift));
    }
    fetchActiveLogs();

    const subscription = supabase
      .channel('hotel_logs_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hotel_security_logs' }, () => {
        fetchActiveLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  useEffect(() => {
    if (trafficType === 'supplier_delivery') setAllowedHours(0.75);
    else if (trafficType === 'contractor_engineer') setAllowedHours(4.0);
    else if (trafficType === 'casual_staff_banquet') setAllowedHours(9.0);
    else if (trafficType === 'hotel_guest_visitor') setAllowedHours(2.0);
  }, [trafficType]);

  const fetchActiveLogs = async () => {
    const { data } = await supabase
      .from('hotel_security_logs')
      .select('*')
      .order('check_in_time', { ascending: false });
    if (data) setLogs(data);
  };

  const handleStartShift = async (e) => {
    e.preventDefault();
    if (!guardNameInput.trim()) return alert('Please enter guard name');

    const { data, error } = await supabase
      .from('guard_shifts')
      .insert([{
        guard_name: guardNameInput.trim(),
        gate_location: gateLocation,
        status: 'active'
      }])
      .select()
      .single();

    if (error) return alert(error.message);
    setActiveShift(data);
    localStorage.setItem('active_hotel_shift', JSON.stringify(data));
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
        };
      } catch (err) {
        setStatusMsg('NFC Error: ' + err.message);
      }
    } else {
      setStatusMsg('Web NFC is available on Android Chrome');
    }
  };

  const clearAutofillFields = () => {
    setFullName('');
    setMobileNumber('');
    setCompanyName('');
    setVehiclePlate('');
    setHostDept('');
  };

  const handleDocSearch = (val) => {
    setDocNumber(val);
    if (val.trim().length < 3) {
      clearAutofillFields();
      return;
    }

    const match = logs.find(l =>
        l.doc_number.toLowerCase().includes(val.toLowerCase()) || 
        (l.vehicle_plate && l.vehicle_plate.toLowerCase().includes(val.toLowerCase())) ||
        (l.mobile_number && l.mobile_number.includes(val))
    );
    if (!match) {
      clearAutofillFields();
      return;
    }

    setFullName(match.full_name);
    setMobileNumber(match.mobile_number || '');
    setCompanyName(match.company_name || '');
    setVehiclePlate(match.vehicle_plate || '');
    setHostDept(match.host_room_or_dept || '');
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    if (!passBadgeNo || !fullName || !docNumber) {
      return alert('Fill required fields and assign pass badge');
    }

    const { error } = await supabase.from('hotel_security_logs').insert([{
      shift_id: activeShift?.id || null,
      logged_by_guard: activeShift?.guard_name || 'Terminal Guard',
      full_name: fullName,
      doc_number: docNumber,
      mobile_number: mobileNumber,
      company_name: companyName,
      vehicle_plate: vehiclePlate,
      traffic_type: trafficType,
      purpose_of_visit: purpose || 'Standard Entry',
      host_room_or_dept: hostDept || 'General BOH',
      pass_badge_no: passBadgeNo,
      allowed_hours: allowedHours,
      status: 'inside'
    }]);

    if (error) {
      alert(error.message);
    } else {
      setFullName('');
      setDocNumber('');
      setMobileNumber('');
      setCompanyName('');
      setVehiclePlate('');
      setPurpose('');
      setHostDept('');
      setPassBadgeNo('');
      setStatusMsg('Check-In Successful!');
      fetchActiveLogs();
    }
  };

  const handleCheckOut = async (id, badgeNo) => {
    const { error } = await supabase
      .from('hotel_security_logs')
      .update({
        status: 'checked_out',
        check_out_time: new Date().toISOString(),
        checkout_by_guard: activeShift?.guard_name || 'Terminal Guard'
      })
      .eq('id', id);

    if (error) alert(error.message);
    else {
      setStatusMsg(`Pass #${badgeNo} Checked Out`);
      fetchActiveLogs();
    }
  };

  const exportToExcel = () => {
    const formatted = logs.map(l => ({
      "Pass Badge": l.pass_badge_no,
      "Full Name": l.full_name,
      "Company": l.company_name,
      "Vehicle Plate": l.vehicle_plate,
      "Traffic Type": l.traffic_type,
      "Destination": l.host_room_or_dept,
      "Status": l.status,
      "Check-In Time": l.check_in_time ? new Date(l.check_in_time).toLocaleString() : '',
      "Check-Out Time": l.check_out_time ? new Date(l.check_out_time).toLocaleString() : 'Still Inside',
      "Logged By Guard": l.logged_by_guard,
      "Checked Out By": l.checkout_by_guard || '-'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(formatted);
    XLSX.utils.book_append_sheet(wb, ws, 'Visitor & Contractor Logs');
    XLSX.writeFile(wb, `Hotel_Security_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const insideLogs = logs.filter(l => l.status === 'inside');
  const now = new Date();

  const handleEndShift = async () => {
    if (!activeShift) return;
    const overstays = insideLogs.filter(l => (now - new Date(l.check_in_time)) / 3600000 > l.allowed_hours);

    const handoverText = `*HOTEL SECURITY SHIFT HANDOVER REPORT*
*Gate:* ${activeShift.gate_location}
*Duty Guard:* ${activeShift.guard_name}
*Shift Window:* ${new Date(activeShift.start_time).toLocaleTimeString()} - ${new Date().toLocaleTimeString()}

*TOTAL PROCESSED:* ${logs.length}
*UNRETURNED PASSES INSIDE:* ${insideLogs.length}
${insideLogs.map(b => `• Pass #${b.pass_badge_no}: ${b.full_name} (${b.host_room_or_dept})`).join('\n')}

*ACTIVE OVERSTAYS:* ${overstays.length}
${overstays.map(o => `• ⚠️ Pass #${o.pass_badge_no}: ${o.full_name} (${o.company_name || 'Visitor'})`).join('\n')}

*NOTES:* ${handoverNotes || 'All operations normal.'}`;

    navigator.clipboard.writeText(handoverText);
    alert('Handover summary copied to clipboard for WhatsApp!');

    await supabase.from('guard_shifts').update({
      end_time: new Date().toISOString(),
      status: 'completed',
      handover_notes: handoverNotes
    }).eq('id', activeShift.id);

    localStorage.removeItem('active_hotel_shift');
    setActiveShift(null);
    setShowHandoverModal(false);
  };

  if (!activeShift) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Hotel Security Pass</h1>
              <p className="text-sm text-slate-400">Shift Terminal Login</p>
            </div>
          </div>

          <form onSubmit={handleStartShift} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Duty Guard Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Officer Satnam"
                value={guardNameInput}
                onChange={(e) => setGuardNameInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Gate Location</label>
              <select
                value={gateLocation}
                onChange={(e) => setGateLocation(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              >
                <option>Loading Bay / BOH Gate</option>
                <option>Main Lobby Concierge</option>
                <option>Staff Time Office</option>
                <option>Contractor West Gate</option>
              </select>
            </div>

            <button type="submit" className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-white transition-all shadow-lg">
              Start Duty Shift
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12 font-sans">
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-500" />
          <div>
            <div className="font-bold text-sm leading-tight">{activeShift.gate_location}</div>
            <div className="text-xs text-slate-400">On Duty: <span className="text-blue-400 font-medium">{activeShift.guard_name}</span></div>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setViewMode(viewMode === 'guard' ? 'manager' : 'guard')} 
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium hover:bg-slate-700 text-white"
          >
            {viewMode === 'guard' ? 'Manager View' : 'Guard View'}
          </button>
          <button 
            onClick={() => setShowHandoverModal(true)}
            className="px-3 py-1.5 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium hover:bg-amber-600/30 flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" /> End Shift
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">Inside Now</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">{insideLogs.length}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">Overstay Alerts</div>
            <div className="text-2xl font-bold text-red-400 mt-1">
              {insideLogs.filter(l => (now - new Date(l.check_in_time)) / 3600000 > l.allowed_hours).length}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">Total Processed</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{logs.length}</div>
          </div>
        </div>

        {viewMode === 'guard' && (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h2 className="text-base font-bold mb-4 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-400" /> Fast Pass Check-In
              </h2>

              <form onSubmit={handleCheckIn} className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'supplier_delivery', label: 'Supplier / Truck', icon: Truck },
                    { id: 'contractor_engineer', label: 'Contractor', icon: Wrench },
                    { id: 'casual_staff_banquet', label: 'Banquet Casual', icon: Users },
                    { id: 'hotel_guest_visitor', label: 'Guest Visitor', icon: UserCheck },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTrafficType(t.id)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                        trafficType === t.id ? 'bg-blue-600 border-blue-500 text-white shadow-md' : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <t.icon className="w-4 h-4" /> {t.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Doc # / Plate / Mobile (Auto-Match)</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="784-1985... or Plate #"
                        value={docNumber}
                        onChange={(e) => handleDocSearch(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                      <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Driver / Visitor Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Company / Supplier</label>
                    <input
                      type="text"
                      placeholder="e.g. Al Rawabi, Otis, Farnek"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Vehicle Plate (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. DXB A 45892"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Destination / Department</label>
                    <input
                      type="text"
                      placeholder="e.g. Main Kitchen, Plant Room"
                      value={hostDept}
                      onChange={(e) => setHostDept(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">NFC Badge / Physical Pass #</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Pass # or NFC Tap"
                        value={passBadgeNo}
                        onChange={(e) => setPassBadgeNo(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={startNfcScan}
                        className="px-3 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 text-blue-400"
                        title="Scan NFC Badge"
                      >
                        <Smartphone className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {statusMsg && <div className="text-xs text-blue-400 font-mono">{statusMsg}</div>}

                <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white shadow-lg transition-all">
                  Confirm Check-In & Issue Pass
                </button>
              </form>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <h2 className="text-base font-bold flex items-center justify-between">
                <span>Active On Property ({insideLogs.length})</span>
                <span className="text-xs text-slate-400 font-normal">Tap 'Check-Out' when pass is returned</span>
              </h2>

              <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto">
                {insideLogs.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-sm">No visitors or contractors currently inside.</div>
                ) : (
                  insideLogs.map((item) => {
                    const elapsedHours = (now - new Date(item.check_in_time)) / 3600000;
                    const isOverstay = elapsedHours > item.allowed_hours;

                    return (
                      <div key={item.id} className="py-3 flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-600/30 text-blue-300 font-mono text-xs rounded border border-blue-500/40">
                              Pass #{item.pass_badge_no}
                            </span>
                            <span className="font-bold text-sm text-white">{item.full_name}</span>
                            {item.vehicle_plate && (
                              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                                {item.vehicle_plate}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {item.company_name && <span>{item.company_name} • </span>}
                            <span>Dest: {item.host_room_or_dept}</span> • 
                            <span className="text-slate-500"> In: {new Date(item.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {isOverstay && (
                            <div className="text-xs text-red-400 font-semibold flex items-center gap-1 mt-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> OVERSTAY: {elapsedHours.toFixed(1)}h (Limit: {item.allowed_hours}h)
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleCheckOut(item.id, item.pass_badge_no)}
                          className="px-3 py-2 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 rounded-lg text-xs font-bold whitespace-nowrap"
                        >
                          Check-Out
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <h2 className="text-base font-bold">Recent Check-Outs</h2>
              <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto">
                {logs.filter(l => l.status === 'checked_out').slice(0, 10).map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-sm text-white">{item.full_name}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Pass #{item.pass_badge_no} {item.company_name && <span>• {item.company_name}</span>}
                      </div>
                    </div>
                    <div className="text-right text-xs font-mono whitespace-nowrap">
                      <div className="text-emerald-400">In: {new Date(item.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="text-amber-400">Out: {item.check_out_time ? new Date(item.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                    </div>
                  </div>
                ))}
                {logs.every(l => l.status !== 'checked_out') && (
                  <div className="py-6 text-center text-slate-500 text-sm">No completed check-outs yet.</div>
                )}
              </div>
            </div>
          </>
        )}

        {viewMode === 'manager' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div>
                <h2 className="font-bold text-base text-white">Security Audit Log & Time Tracking</h2>
                <p className="text-xs text-slate-400">All check-ins, check-outs, and duration records</p>
              </div>
              <button
                onClick={exportToExcel}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow"
              >
                <Download className="w-4 h-4" /> Export Excel Log (.xlsx)
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
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
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-6 text-center text-slate-500">No logs found.</td>
                      </tr>
                    ) : (
                      logs.map((l) => {
                        const inTime = l.check_in_time ? new Date(l.check_in_time) : null;
                        const outTime = l.check_out_time ? new Date(l.check_out_time) : null;
                        
                        let durationDisplay = '-';
                        if (inTime && outTime) {
                          const diffMinutes = Math.round((outTime - inTime) / 60000);
                          if (diffMinutes < 60) {
                            durationDisplay = `${diffMinutes}m`;
                          } else {
                            const hrs = (diffMinutes / 60).toFixed(1);
                            durationDisplay = `${hrs}h`;
                          }
                        } else if (inTime && l.status === 'inside') {
                          const diffMinutes = Math.round((now - inTime) / 60000);
                          durationDisplay = diffMinutes < 60 ? `${diffMinutes}m (Active)` : `${(diffMinutes / 60).toFixed(1)}h (Active)`;
                        }

                        return (
                          <tr key={l.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-3 font-mono text-blue-400 font-bold">#{l.pass_badge_no}</td>
                            <td className="p-3">
                              <div className="font-semibold text-white">{l.full_name}</div>
                              <div className="text-slate-400 text-[11px]">{l.company_name || l.doc_number}</div>
                            </td>
                            <td className="p-3 uppercase text-[10px] text-slate-400">{l.traffic_type?.replace(/_/g, ' ')}</td>
                            <td className="p-3 font-mono text-emerald-400 whitespace-nowrap">
                              {inTime ? inTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>
                            <td className="p-3 font-mono text-amber-400 whitespace-nowrap">
                              {outTime ? (
                                outTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 font-medium">Still Inside</span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-slate-300">{durationDisplay}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                l.status === 'inside' ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {l.status === 'inside' ? 'Inside' : 'Checked Out'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-400 text-[11px]">
                              <div>In: {l.logged_by_guard}</div>
                              {l.checkout_by_guard && <div className="text-slate-500 text-[10px]">Out: {l.checkout_by_guard}</div>}
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

      {showHandoverModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Shift Handover Summary</h3>
            <p className="text-xs text-slate-400">Generate formatted WhatsApp report and close shift.</p>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 text-xs">
              <div><b>Active Passes Inside:</b> {insideLogs.length}</div>
              <div><b>Overstay Warnings:</b> {insideLogs.filter(l => (now - new Date(l.check_in_time)) / 3600000 > l.allowed_hours).length}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Handover Notes / Key Incidents</label>
              <textarea
                rows={3}
                placeholder="e.g. Chiller contractor still in Plant Room until 22:00..."
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowHandoverModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndShift}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-bold text-white shadow-lg"
              >
                Copy WhatsApp & End
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}