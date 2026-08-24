import XLSX from 'xlsx-js-style';
import { supabase } from '../supabaseClient';
import { parseLogDetails } from './logFormatter';

const formatTimeOnly = (d) => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '—';
  }
};

const formatDateBanner = (d) => {
  if (!d) return 'UNKNOWN DATE';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  } catch {
    return 'UNKNOWN DATE';
  }
};

const formatSecurityName = (name) => {
  if (!name) return '—';
  const clean = name.trim();
  if (clean.toLowerCase().startsWith('sec.') || clean.toLowerCase().startsWith('officer')) {
    return clean;
  }
  return `SEC. ${clean}`;
};

const formatAllowedTime = (ah) => {
  const h = Number(ah) > 0 ? Number(ah) : 2;
  if (h < 1) {
    return `${Math.round(h * 60)} mins`;
  }
  return `${h} hr${h === 1 ? '' : 's'}`;
};

/* ── STYLES DEFINITION ────────────────────────────────────────── */
const BORDER_THIN = {
  top:    { style: 'thin', color: { rgb: 'D9D9D9' } },
  bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
  left:   { style: 'thin', color: { rgb: 'D9D9D9' } },
  right:  { style: 'thin', color: { rgb: 'D9D9D9' } },
};

const STYLE_TITLE_BANNER = {
  font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '1F3864' } }, // Deep Navy Blue
  alignment: { horizontal: 'center', vertical: 'center' },
};

const STYLE_HEADER_LABEL = {
  font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: '1F3864' } },
  alignment: { horizontal: 'right', vertical: 'center' },
};

const STYLE_DATE_INPUT_BOX = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '1F3864' } },
  fill: { fgColor: { rgb: 'FFF2CC' } }, // Pale Gold / Cream
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER_THIN,
};

const STYLE_SUBTITLE_TEXT = {
  font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '595959' } },
  alignment: { horizontal: 'left', vertical: 'center' },
};

const STYLE_COLUMN_HEADER = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '1F3864' } }, // Deep Navy Blue
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top:    { style: 'medium', color: { rgb: '0F243E' } },
    bottom: { style: 'medium', color: { rgb: '0F243E' } },
    left:   { style: 'thin',   color: { rgb: '2E4D7B' } },
    right:  { style: 'thin',   color: { rgb: '2E4D7B' } },
  },
};

const STYLE_DATE_BANNER = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '2F5597' } }, // Royal Blue
  alignment: { horizontal: 'center', vertical: 'center' },
  border: {
    top:    { style: 'thin', color: { rgb: '1F3864' } },
    bottom: { style: 'thin', color: { rgb: '1F3864' } },
  },
};

const STYLE_CELL_LEFT = {
  font: { name: 'Calibri', sz: 9.5, color: { rgb: '1F2937' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: BORDER_THIN,
};

const STYLE_CELL_CENTER = {
  font: { name: 'Calibri', sz: 9.5, color: { rgb: '1F2937' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER_THIN,
};

const STYLE_CELL_ALLOWED = {
  font: { name: 'Calibri', sz: 9.5, bold: true, color: { rgb: '1E40AF' } },
  fill: { fgColor: { rgb: 'EFF6FF' } }, // Soft Blue
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER_THIN,
};

const STYLE_CELL_PASS = {
  font: { name: 'Consolas', sz: 9.5, bold: true, color: { rgb: '1F3864' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER_THIN,
};

const STYLE_CELL_TIME = {
  font: { name: 'Calibri', sz: 9.5, bold: true, color: { rgb: '0F5132' } },
  fill: { fgColor: { rgb: 'F0FDF4' } }, // Light Mint Green
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER_THIN,
};

const STYLE_CELL_OVERSTAY = {
  font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: '991B1B' } },
  fill: { fgColor: { rgb: 'FEE2E2' } }, // Light Red
  alignment: { horizontal: 'left', vertical: 'center' },
  border: BORDER_THIN,
};

const STYLE_CELL_EXTENDED = {
  font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: '0E7490' } },
  fill: { fgColor: { rgb: 'ECFEFF' } }, // Light Cyan
  alignment: { horizontal: 'left', vertical: 'center' },
  border: BORDER_THIN,
};

const STYLE_CELL_ON_TIME = {
  font: { name: 'Calibri', sz: 9, color: { rgb: '4B5563' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: BORDER_THIN,
};

/**
 * Builds standard worksheet for Master Register, Visitors, Suppliers, and Casuals.
 * Includes "Allowed Time" column.
 */
function buildStyledStandardWorksheet(items, subtitle) {
  const sorted = [...items].sort((a, b) => new Date(a.check_in_time) - new Date(b.check_in_time));

  const dateGroups = {};
  sorted.forEach((l) => {
    const dStr = formatDateBanner(l.check_in_time);
    if (!dateGroups[dStr]) dateGroups[dStr] = [];
    dateGroups[dStr].push(l);
  });

  const todayDisplay = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const rows = [];
  const merges = [];

  // ROW 1: Title Banner
  const row1 = Array(15).fill(null).map(() => ({ v: '', s: STYLE_TITLE_BANNER }));
  row1[0] = { v: 'VISITOR ACCESS & SECURITY LOG', s: STYLE_TITLE_BANNER };
  rows.push(row1);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 14 } });

  // ROW 2: Subheader
  const row2 = Array(15).fill(null).map(() => ({ v: '', s: {} }));
  row2[0] = { v: 'SELECT / ENTER DATE:', s: STYLE_HEADER_LABEL };
  row2[1] = { v: '', s: STYLE_HEADER_LABEL };
  row2[2] = { v: todayDisplay, s: STYLE_DATE_INPUT_BOX };
  row2[3] = { v: '', s: {} };
  row2[4] = { v: subtitle, s: STYLE_SUBTITLE_TEXT };
  rows.push(row2);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 1 } });
  merges.push({ s: { r: 1, c: 4 }, e: { r: 1, c: 14 } });

  // ROW 3: Spacing
  rows.push(Array(15).fill(null).map(() => ({ v: '', s: {} })));

  // ROW 4: Column Headers (with Allowed Time)
  const headers = [
    'Name',
    'Nationality',
    'Company Name',
    'Purpose of Visit',
    'Allowed Time',
    'Vehicle No.',
    'Mobile Number',
    'Visiting Person',
    'Department',
    'Pass Number',
    'Time In',
    'Security In',
    'Time Out',
    'Security Out',
    'Stay Duration & Overstay Status',
  ];
  rows.push(headers.map((h) => ({ v: h, s: STYLE_COLUMN_HEADER })));

  let currentRowIdx = 4;
  const dateKeys = Object.keys(dateGroups);

  if (dateKeys.length === 0) {
    const emptyRow = Array(15).fill(null).map(() => ({ v: '', s: STYLE_CELL_CENTER }));
    emptyRow[0] = { v: 'No records logged for this category', s: STYLE_CELL_CENTER };
    rows.push(emptyRow);
    merges.push({ s: { r: currentRowIdx, c: 0 }, e: { r: currentRowIdx, c: 14 } });
    currentRowIdx++;
  } else {
    dateKeys.forEach((dateBanner) => {
      const bannerRow = Array(15).fill(null).map(() => ({ v: '', s: STYLE_DATE_BANNER }));
      bannerRow[0] = { v: dateBanner, s: STYLE_DATE_BANNER };
      rows.push(bannerRow);
      merges.push({ s: { r: currentRowIdx, c: 0 }, e: { r: currentRowIdx, c: 14 } });
      currentRowIdx++;

      dateGroups[dateBanner].forEach((l) => {
        const info = parseLogDetails(l);

        const inTimeMs = new Date(l.check_in_time).getTime();
        const outTimeMs = l.check_out_time ? new Date(l.check_out_time).getTime() : Date.now();
        const durationHours = (outTimeMs - inTimeMs) / 3600000;
        const allowedH = Number(l.allowed_hours) > 0 ? Number(l.allowed_hours) : 2;
        const isOverstay = durationHours > allowedH;

        let stayStatusNote;
        let stayStyle;

        if (info.isExtended) {
          stayStatusNote = `⏱️ EXTENDED: ${info.extHours ? `+${info.extHours}h ` : ''}(${info.extReason || 'Approved'})`;
          stayStyle = STYLE_CELL_EXTENDED;
        } else if (isOverstay) {
          const exceededH = (durationHours - allowedH).toFixed(1);
          stayStatusNote = `⚠️ OVERSTAYED by +${exceededH}h (${durationHours.toFixed(1)}h / ${allowedH}h allowed)`;
          stayStyle = STYLE_CELL_OVERSTAY;
        } else {
          if (l.status === 'inside') {
            stayStatusNote = `Active Inside (${durationHours.toFixed(1)}h / ${allowedH}h allowed)`;
            stayStyle = STYLE_CELL_ON_TIME;
          } else {
            stayStatusNote = `Completed (${durationHours.toFixed(1)}h • On Time)`;
            stayStyle = STYLE_CELL_ON_TIME;
          }
        }

        const dataRow = [
          { v: l.full_name || '—',                    s: STYLE_CELL_LEFT },
          { v: l.nationality || '—',                  s: STYLE_CELL_CENTER },
          { v: l.company_name || '—',                 s: STYLE_CELL_LEFT },
          { v: info.cleanPurpose,                     s: STYLE_CELL_LEFT },
          { v: formatAllowedTime(l.allowed_hours),    s: STYLE_CELL_ALLOWED },
          { v: l.vehicle_plate || 'Walk-in',          s: STYLE_CELL_CENTER },
          { v: l.mobile_number || '—',                s: STYLE_CELL_CENTER },
          { v: info.visitingPerson || '—',            s: STYLE_CELL_LEFT },
          { v: info.department,                       s: STYLE_CELL_CENTER },
          { v: l.pass_badge_no || 'CASUAL',           s: STYLE_CELL_PASS },
          { v: formatTimeOnly(l.check_in_time),       s: STYLE_CELL_TIME },
          { v: formatSecurityName(l.logged_by_guard), s: STYLE_CELL_CENTER },
          { v: formatTimeOnly(l.check_out_time),      s: l.check_out_time ? STYLE_CELL_TIME : STYLE_CELL_CENTER },
          { v: formatSecurityName(l.checkout_by_guard), s: STYLE_CELL_CENTER },
          { v: stayStatusNote,                        s: stayStyle },
        ];

        rows.push(dataRow);
        currentRowIdx++;
      });
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => r.map((c) => c.v)));

  rows.forEach((rowObj, rIdx) => {
    rowObj.forEach((cellObj, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
      if (!ws[cellRef]) ws[cellRef] = { v: cellObj.v, t: typeof cellObj.v === 'number' ? 'n' : 's' };
      ws[cellRef].s = cellObj.s;
    });
  });

  ws['!cols'] = [
    { wch: 22 }, // Name
    { wch: 14 }, // Nationality
    { wch: 24 }, // Company Name
    { wch: 22 }, // Purpose of Visit
    { wch: 15 }, // Allowed Time
    { wch: 15 }, // Vehicle No.
    { wch: 18 }, // Mobile Number
    { wch: 20 }, // Visiting Person
    { wch: 18 }, // Department
    { wch: 14 }, // Pass Number
    { wch: 12 }, // Time In
    { wch: 16 }, // Security In
    { wch: 12 }, // Time Out
    { wch: 16 }, // Security Out
    { wch: 42 }, // Stay Duration & Overstay Status
  ];

  ws['!merges'] = merges;
  ws['!views'] = [{ state: 'frozen', ySplit: 4, topLeftCell: 'A5', activeCell: 'A5' }];
  return ws;
}

/**
 * Builds specialized Contractors worksheet.
 */
function buildStyledContractorsWorksheet(items, subtitle) {
  const sorted = [...items].sort((a, b) => new Date(a.check_in_time) - new Date(b.check_in_time));

  const dateGroups = {};
  sorted.forEach((l) => {
    const dStr = formatDateBanner(l.check_in_time);
    if (!dateGroups[dStr]) dateGroups[dStr] = [];
    dateGroups[dStr].push(l);
  });

  const todayDisplay = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const rows = [];
  const merges = [];

  // ROW 1: Title Banner
  const row1 = Array(16).fill(null).map(() => ({ v: '', s: STYLE_TITLE_BANNER }));
  row1[0] = { v: 'VISITOR ACCESS & SECURITY LOG — CONTRACTORS REGISTER', s: STYLE_TITLE_BANNER };
  rows.push(row1);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 15 } });

  // ROW 2: Subheader
  const row2 = Array(16).fill(null).map(() => ({ v: '', s: {} }));
  row2[0] = { v: 'SELECT / ENTER DATE:', s: STYLE_HEADER_LABEL };
  row2[1] = { v: '', s: STYLE_HEADER_LABEL };
  row2[2] = { v: todayDisplay, s: STYLE_DATE_INPUT_BOX };
  row2[3] = { v: '', s: {} };
  row2[4] = { v: subtitle, s: STYLE_SUBTITLE_TEXT };
  rows.push(row2);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 1 } });
  merges.push({ s: { r: 1, c: 4 }, e: { r: 1, c: 15 } });

  // ROW 3: Spacing
  rows.push(Array(16).fill(null).map(() => ({ v: '', s: {} })));

  // ROW 4: Column Headers (with Allowed Duration of Work)
  const headers = [
    'Name',
    'Nationality',
    'Company Name',
    'Type of Work',
    'PTW Number',
    'Area of Work',
    'Allowed Duration of Work',
    'Vehicle No.',
    'Mobile Number',
    'Department',
    'Pass Number',
    'Time In',
    'Security In',
    'Time Out',
    'Security Out',
    'Stay Duration & Overstay Status',
  ];
  rows.push(headers.map((h) => ({ v: h, s: STYLE_COLUMN_HEADER })));

  let currentRowIdx = 4;
  const dateKeys = Object.keys(dateGroups);

  if (dateKeys.length === 0) {
    const emptyRow = Array(16).fill(null).map(() => ({ v: '', s: STYLE_CELL_CENTER }));
    emptyRow[0] = { v: 'No contractor records logged', s: STYLE_CELL_CENTER };
    rows.push(emptyRow);
    merges.push({ s: { r: currentRowIdx, c: 0 }, e: { r: currentRowIdx, c: 15 } });
    currentRowIdx++;
  } else {
    dateKeys.forEach((dateBanner) => {
      const bannerRow = Array(16).fill(null).map(() => ({ v: '', s: STYLE_DATE_BANNER }));
      bannerRow[0] = { v: dateBanner, s: STYLE_DATE_BANNER };
      rows.push(bannerRow);
      merges.push({ s: { r: currentRowIdx, c: 0 }, e: { r: currentRowIdx, c: 15 } });
      currentRowIdx++;

      dateGroups[dateBanner].forEach((l) => {
        const info = parseLogDetails(l);

        const inTimeMs = new Date(l.check_in_time).getTime();
        const outTimeMs = l.check_out_time ? new Date(l.check_out_time).getTime() : Date.now();
        const durationHours = (outTimeMs - inTimeMs) / 3600000;
        const allowedH = Number(l.allowed_hours) > 0 ? Number(l.allowed_hours) : 4;
        const isOverstay = durationHours > allowedH;

        let stayStatusNote;
        let stayStyle;

        if (info.isExtended) {
          stayStatusNote = `⏱️ EXTENDED: ${info.extHours ? `+${info.extHours}h ` : ''}(${info.extReason || 'Approved'})`;
          stayStyle = STYLE_CELL_EXTENDED;
        } else if (isOverstay) {
          const exceededH = (durationHours - allowedH).toFixed(1);
          stayStatusNote = `⚠️ OVERSTAYED by +${exceededH}h (${durationHours.toFixed(1)}h / ${allowedH}h allowed)`;
          stayStyle = STYLE_CELL_OVERSTAY;
        } else {
          if (l.status === 'inside') {
            stayStatusNote = `Active Inside (${durationHours.toFixed(1)}h / ${allowedH}h allowed)`;
            stayStyle = STYLE_CELL_ON_TIME;
          } else {
            stayStatusNote = `Completed (${durationHours.toFixed(1)}h • On Time)`;
            stayStyle = STYLE_CELL_ON_TIME;
          }
        }

        const dataRow = [
          { v: l.full_name || '—',                    s: STYLE_CELL_LEFT },
          { v: l.nationality || '—',                  s: STYLE_CELL_CENTER },
          { v: l.company_name || '—',                 s: STYLE_CELL_LEFT },
          { v: info.workKind || 'General Work',       s: STYLE_CELL_LEFT },
          { v: info.workPermit || '—',                s: STYLE_CELL_CENTER },
          { v: info.workArea || '—',                  s: STYLE_CELL_LEFT },
          { v: formatAllowedTime(l.allowed_hours),    s: STYLE_CELL_ALLOWED },
          { v: l.vehicle_plate || 'Walk-in',          s: STYLE_CELL_CENTER },
          { v: l.mobile_number || '—',                s: STYLE_CELL_CENTER },
          { v: info.department,                       s: STYLE_CELL_CENTER },
          { v: l.pass_badge_no || 'CONTRACTOR',       s: STYLE_CELL_PASS },
          { v: formatTimeOnly(l.check_in_time),       s: STYLE_CELL_TIME },
          { v: formatSecurityName(l.logged_by_guard), s: STYLE_CELL_CENTER },
          { v: formatTimeOnly(l.check_out_time),      s: l.check_out_time ? STYLE_CELL_TIME : STYLE_CELL_CENTER },
          { v: formatSecurityName(l.checkout_by_guard), s: STYLE_CELL_CENTER },
          { v: stayStatusNote,                        s: stayStyle },
        ];

        rows.push(dataRow);
        currentRowIdx++;
      });
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => r.map((c) => c.v)));

  rows.forEach((rowObj, rIdx) => {
    rowObj.forEach((cellObj, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
      if (!ws[cellRef]) ws[cellRef] = { v: cellObj.v, t: typeof cellObj.v === 'number' ? 'n' : 's' };
      ws[cellRef].s = cellObj.s;
    });
  });

  ws['!cols'] = [
    { wch: 22 }, // Name
    { wch: 14 }, // Nationality
    { wch: 24 }, // Company Name
    { wch: 20 }, // Type of Work
    { wch: 15 }, // PTW Number
    { wch: 20 }, // Area of Work
    { wch: 24 }, // Allowed Duration of Work
    { wch: 15 }, // Vehicle No.
    { wch: 18 }, // Mobile Number
    { wch: 22 }, // Department
    { wch: 14 }, // Pass Number
    { wch: 12 }, // Time In
    { wch: 16 }, // Security In
    { wch: 12 }, // Time Out
    { wch: 16 }, // Security Out
    { wch: 42 }, // Stay Duration & Overstay Status
  ];

  ws['!merges'] = merges;
  ws['!views'] = [{ state: 'frozen', ySplit: 4, topLeftCell: 'A5', activeCell: 'A5' }];
  return ws;
}

/**
 * Builds the Executive Summary Sheet with styled KPI cards, category metrics, and totals.
 */
function buildStyledSummaryWorksheet(logs) {
  const totalRecords = logs.length;
  const insideCount = logs.filter((l) => l.status === 'inside').length;
  const checkedOutCount = logs.filter((l) => l.status === 'checked_out').length;
  const extensionsCount = logs.filter((l) => l.purpose_of_visit?.includes('[Ext')).length;

  const overstayLogs = logs.filter((l) => {
    const inMs = new Date(l.check_in_time).getTime();
    const outMs = l.check_out_time ? new Date(l.check_out_time).getTime() : Date.now();
    const durH = (outMs - inMs) / 3600000;
    const allowedH = Number(l.allowed_hours) > 0 ? Number(l.allowed_hours) : 2;
    return durH > allowedH && !l.purpose_of_visit?.includes('[Ext');
  });

  const categoriesDef = [
    { key: 'hotel_guest_visitor',  name: 'Visitors (Guests, Meetings, Interviews)' },
    { key: 'contractor_engineer',  name: 'Contractors & Engineering Works' },
    { key: 'supplier_delivery',    name: 'Suppliers & Delivery Trucks' },
    { key: 'casual_staff_banquet', name: 'Casual Staff (F&B, HK, Stewarding, etc.)' },
  ];

  const catRows = categoriesDef.map((cat) => {
    const list = logs.filter((l) => l.traffic_type === cat.key);
    const count = list.length;
    const inside = list.filter((l) => l.status === 'inside').length;
    const checkedOut = list.filter((l) => l.status === 'checked_out').length;
    const ext = list.filter((l) => l.purpose_of_visit?.includes('[Ext')).length;
    const overstays = list.filter((l) => {
      const inMs = new Date(l.check_in_time).getTime();
      const outMs = l.check_out_time ? new Date(l.check_out_time).getTime() : Date.now();
      const durH = (outMs - inMs) / 3600000;
      const allowedH = Number(l.allowed_hours) > 0 ? Number(l.allowed_hours) : 2;
      return durH > allowedH && !l.purpose_of_visit?.includes('[Ext');
    }).length;

    const pct = totalRecords > 0 ? ((count / totalRecords) * 100).toFixed(1) + '%' : '0%';
    return [
      { v: cat.name,   s: STYLE_CELL_LEFT },
      { v: count,      s: STYLE_CELL_CENTER },
      { v: inside,     s: STYLE_CELL_CENTER },
      { v: checkedOut, s: STYLE_CELL_CENTER },
      { v: overstays,  s: overstays > 0 ? STYLE_CELL_OVERSTAY : STYLE_CELL_CENTER },
      { v: ext,        s: ext > 0 ? STYLE_CELL_EXTENDED : STYLE_CELL_CENTER },
      { v: pct,        s: STYLE_CELL_CENTER },
    ];
  });

  const deptCounts = {};
  logs.forEach((l) => {
    let d = (l.host_room_or_dept || 'General').split('(Visiting:')[0].split('— Area:')[0].trim();
    if (!d) d = 'General';
    deptCounts[d] = (deptCounts[d] || 0) + 1;
  });

  const deptRows = Object.entries(deptCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([dept, count]) => [
      { v: dept,                                                              s: STYLE_CELL_LEFT },
      { v: count,                                                             s: STYLE_CELL_CENTER },
      { v: totalRecords > 0 ? ((count / totalRecords) * 100).toFixed(1) + '%' : '0%', s: STYLE_CELL_CENTER },
      { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} },
    ]);

  const guardActivity = {};
  logs.forEach((l) => {
    if (l.logged_by_guard) {
      const g = formatSecurityName(l.logged_by_guard);
      guardActivity[g] = guardActivity[g] || { checkIns: 0, checkOuts: 0 };
      guardActivity[g].checkIns += 1;
    }
    if (l.checkout_by_guard) {
      const g = formatSecurityName(l.checkout_by_guard);
      guardActivity[g] = guardActivity[g] || { checkIns: 0, checkOuts: 0 };
      guardActivity[g].checkOuts += 1;
    }
  });

  const guardRows = Object.entries(guardActivity)
    .sort((a, b) => (b[1].checkIns + b[1].checkOuts) - (a[1].checkIns + a[1].checkOuts))
    .map(([guard, act]) => [
      { v: guard,                   s: STYLE_CELL_LEFT },
      { v: act.checkIns,            s: STYLE_CELL_CENTER },
      { v: act.checkOuts,           s: STYLE_CELL_CENTER },
      { v: act.checkIns + act.checkOuts, s: STYLE_CELL_CENTER },
      { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} },
    ]);

  const rows = [
    Array(7).fill(null).map((_, i) => ({ v: i === 0 ? 'HOTEL SECURITY & VISITOR ACCESS — EXECUTIVE SUMMARY REPORT' : '', s: STYLE_TITLE_BANNER })),
    Array(7).fill(null).map((_, i) => ({ v: i === 0 ? `Report Generated: ${new Date().toLocaleString()}` : '', s: STYLE_SUBTITLE_TEXT })),
    Array(7).fill(null).map(() => ({ v: '', s: {} })),

    [
      { v: 'KEY AUDIT METRICS', s: STYLE_COLUMN_HEADER },
      { v: 'VALUE', s: STYLE_COLUMN_HEADER },
      { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} },
    ],
    [{ v: 'Total Access Entries Logged', s: STYLE_CELL_LEFT }, { v: totalRecords, s: STYLE_CELL_CENTER }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }],
    [{ v: 'Currently On Property (Active Inside)', s: STYLE_CELL_LEFT }, { v: insideCount, s: STYLE_CELL_CENTER }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }],
    [{ v: 'Total Departures (Checked Out)', s: STYLE_CELL_LEFT }, { v: checkedOutCount, s: STYLE_CELL_CENTER }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }],
    [{ v: 'Total Overstay Incidents Logged', s: STYLE_CELL_LEFT }, { v: overstayLogs.length, s: overstayLogs.length > 0 ? STYLE_CELL_OVERSTAY : STYLE_CELL_CENTER }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }],
    [{ v: 'Total Manager Time Extensions Granted', s: STYLE_CELL_LEFT }, { v: extensionsCount, s: extensionsCount > 0 ? STYLE_CELL_EXTENDED : STYLE_CELL_CENTER }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }],
    Array(7).fill(null).map(() => ({ v: '', s: {} })),

    [
      { v: 'CATEGORY BREAKDOWN', s: STYLE_COLUMN_HEADER },
      { v: 'TOTAL ENTRIES', s: STYLE_COLUMN_HEADER },
      { v: 'CURRENTLY INSIDE', s: STYLE_COLUMN_HEADER },
      { v: 'CHECKED OUT', s: STYLE_COLUMN_HEADER },
      { v: 'OVERSTAYS', s: STYLE_COLUMN_HEADER },
      { v: 'EXTENSIONS', s: STYLE_COLUMN_HEADER },
      { v: 'TRAFFIC SHARE (%)', s: STYLE_COLUMN_HEADER },
    ],
    ...catRows,
    [
      { v: 'GRAND TOTAL', s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'left' } } },
      { v: totalRecords, s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center' } } },
      { v: insideCount, s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center' } } },
      { v: checkedOutCount, s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center' } } },
      { v: overstayLogs.length, s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center' } } },
      { v: extensionsCount, s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center' } } },
      { v: '100.0%', s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center' } } },
    ],
    Array(7).fill(null).map(() => ({ v: '', s: {} })),

    [
      { v: 'DEPARTMENT DISTRIBUTION', s: STYLE_COLUMN_HEADER },
      { v: 'TOTAL VISITS', s: STYLE_COLUMN_HEADER },
      { v: 'SHARE (%)', s: STYLE_COLUMN_HEADER },
      { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} },
    ],
    ...deptRows,
    Array(7).fill(null).map(() => ({ v: '', s: {} })),

    [
      { v: 'SECURITY OFFICER', s: STYLE_COLUMN_HEADER },
      { v: 'CHECK-INS LOGGED', s: STYLE_COLUMN_HEADER },
      { v: 'CHECK-OUTS LOGGED', s: STYLE_COLUMN_HEADER },
      { v: 'TOTAL OPERATIONS', s: STYLE_COLUMN_HEADER },
      { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} },
    ],
    ...guardRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => r.map((c) => c.v)));

  rows.forEach((rowObj, rIdx) => {
    rowObj.forEach((cellObj, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
      if (!ws[cellRef]) ws[cellRef] = { v: cellObj.v, t: typeof cellObj.v === 'number' ? 'n' : 's' };
      ws[cellRef].s = cellObj.s;
    });
  });

  ws['!cols'] = [
    { wch: 45 },
    { wch: 18 },
    { wch: 20 },
    { wch: 16 },
    { wch: 15 },
    { wch: 15 },
    { wch: 20 },
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
  ];

  ws['!views'] = [{ state: 'frozen', ySplit: 3, topLeftCell: 'A4', activeCell: 'A4' }];
  return ws;
}

/**
 * Generates and downloads the complete multi-sheet styled executive workbook.
 */
export async function generateProfessionalExcelReport(initialLogs, notify) {
  if (notify) notify('⏳ Generating complete master log report…', 'info');

  let allMasterLogs = initialLogs || [];
  try {
    const { data: dbLogs, error } = await supabase
      .from('hotel_security_logs')
      .select('*')
      .order('check_in_time', { ascending: false });

    if (!error && dbLogs && dbLogs.length > 0) {
      allMasterLogs = dbLogs;
    }
  } catch (err) {
    console.warn('Could not query master logs, using local array:', err);
  }

  const wb = XLSX.utils.book_new();

  // 1. Executive Summary Tab
  const wsSummary = buildStyledSummaryWorksheet(allMasterLogs);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // 2. Master Register (Full Database with Allowed Time column)
  const wsMaster = buildStyledStandardWorksheet(allMasterLogs, "MASTER REGISTER • Complete chronological log of all visitor & security traffic.");
  XLSX.utils.book_append_sheet(wb, wsMaster, 'Master Register');

  // 3. Visitors Tab (with Allowed Time)
  const visitorItems = allMasterLogs.filter((l) => l.traffic_type === 'hotel_guest_visitor');
  const wsVisitors = buildStyledStandardWorksheet(visitorItems, "VISITORS REGISTER • Guest, business meetings, and official visitors.");
  XLSX.utils.book_append_sheet(wb, wsVisitors, 'Visitors');

  // 4. Contractors Tab (with Allowed Duration of Work column)
  const contractorItems = allMasterLogs.filter((l) => l.traffic_type === 'contractor_engineer');
  const wsContractors = buildStyledContractorsWorksheet(contractorItems, "CONTRACTORS REGISTER • External contractors, technicians & PTW works.");
  XLSX.utils.book_append_sheet(wb, wsContractors, 'Contractors');

  // 5. Suppliers Tab (with Allowed Time)
  const supplierItems = allMasterLogs.filter((l) => l.traffic_type === 'supplier_delivery');
  const wsSuppliers = buildStyledStandardWorksheet(supplierItems, "SUPPLIERS REGISTER • Delivery trucks, materials & vendors.");
  XLSX.utils.book_append_sheet(wb, wsSuppliers, 'Suppliers');

  // 6. Casuals Tab (with Allowed Time)
  const casualItems = allMasterLogs.filter((l) => l.traffic_type === 'casual_staff_banquet');
  const wsCasuals = buildStyledStandardWorksheet(casualItems, "CASUAL STAFF REGISTER • F&B, Housekeeping, Stewarding & Entertainment.");
  XLSX.utils.book_append_sheet(wb, wsCasuals, 'Casuals');

  const filename = `Visitor-Access-Security-Log-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);

  if (notify) {
    notify(`✅ Downloaded complete Security Log Report (${allMasterLogs.length} total entries)`, 'success');
  }
}
