import XLSX from 'xlsx-js-style';

const TRAFFIC_LABELS = {
  supplier_delivery:    'Supplier',
  contractor_engineer:  'Contractor',
  casual_staff_banquet: 'Casual',
  hotel_guest_visitor:  'Visitor',
};

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

/* ── STYLES DEFINITION (Matches Google Sheet Template) ────────── */
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

/**
 * Builds a styled worksheet matching the exact Google Sheet template.
 */
function buildStyledRegisterWorksheet(items, registerSubtitle) {
  const sorted = [...items].sort((a, b) => new Date(a.check_in_time) - new Date(b.check_in_time));

  // Group by date
  const dateGroups = {};
  sorted.forEach((l) => {
    const dStr = formatDateBanner(l.check_in_time);
    if (!dateGroups[dStr]) dateGroups[dStr] = [];
    dateGroups[dStr].push(l);
  });

  const todayDisplay = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Rows array of cell objects with values and styles
  const rows = [];
  const merges = [];

  // ── ROW 1: Title Banner ──
  const row1 = Array(13).fill(null).map(() => ({ v: '', s: STYLE_TITLE_BANNER }));
  row1[0] = { v: 'VISITOR ACCESS & SECURITY LOG', s: STYLE_TITLE_BANNER };
  rows.push(row1);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 12 } });

  // ── ROW 2: Subheader ──
  const row2 = Array(13).fill(null).map(() => ({ v: '', s: {} }));
  row2[0] = { v: 'SELECT / ENTER DATE:', s: STYLE_HEADER_LABEL };
  row2[1] = { v: '', s: STYLE_HEADER_LABEL };
  row2[2] = { v: todayDisplay, s: STYLE_DATE_INPUT_BOX };
  row2[3] = { v: '', s: {} };
  row2[4] = { v: registerSubtitle || "MASTER REGISTER • Use 'Daily View' to select a date and see only that day's visitors.", s: STYLE_SUBTITLE_TEXT };
  rows.push(row2);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 1 } });
  merges.push({ s: { r: 1, c: 4 }, e: { r: 1, c: 12 } });

  // ── ROW 3: Spacing Row ──
  rows.push(Array(13).fill(null).map(() => ({ v: '', s: {} })));

  // ── ROW 4: Column Headers ──
  const headers = [
    'Name',
    'Nationality',
    'Company Name',
    'Purpose of Visit',
    'Vehicle No.',
    'Mobile Number',
    'Visiting Person',
    'Department',
    'Pass Number',
    'Time In',
    'Security In',
    'Time Out',
    'Security Out',
  ];
  rows.push(headers.map((h) => ({ v: h, s: STYLE_COLUMN_HEADER })));

  let currentRowIdx = 4;

  const dateKeys = Object.keys(dateGroups);
  if (dateKeys.length === 0) {
    const emptyRow = Array(13).fill(null).map(() => ({ v: '', s: STYLE_CELL_CENTER }));
    emptyRow[0] = { v: 'No visitor records logged for this section', s: STYLE_CELL_CENTER };
    rows.push(emptyRow);
    merges.push({ s: { r: currentRowIdx, c: 0 }, e: { r: currentRowIdx, c: 12 } });
    currentRowIdx++;
  } else {
    dateKeys.forEach((dateBanner) => {
      // Date Separator Banner Row
      const bannerRow = Array(13).fill(null).map(() => ({ v: '', s: STYLE_DATE_BANNER }));
      bannerRow[0] = { v: dateBanner, s: STYLE_DATE_BANNER };
      rows.push(bannerRow);
      merges.push({ s: { r: currentRowIdx, c: 0 }, e: { r: currentRowIdx, c: 12 } });
      currentRowIdx++;

      dateGroups[dateBanner].forEach((l) => {
        let dept = l.host_room_or_dept || '—';
        let visitingPerson = '—';

        if (dept.includes('(Visiting:')) {
          const parts = dept.split('(Visiting:');
          dept = parts[0].trim();
          visitingPerson = parts[1].replace(')', '').trim();
        } else if (dept.includes('— Area:')) {
          const parts = dept.split('— Area:');
          dept = parts[0].trim();
          visitingPerson = parts[1].trim();
        }

        let purpose = l.purpose_of_visit || TRAFFIC_LABELS[l.traffic_type] || 'Standard Entry';
        if (purpose.includes('(Visiting:')) {
          purpose = purpose.split('(Visiting:')[0].trim();
        }

        const dataRow = [
          { v: l.full_name || '—',                    s: STYLE_CELL_LEFT },
          { v: l.nationality || '—',                  s: STYLE_CELL_CENTER },
          { v: l.company_name || '—',                 s: STYLE_CELL_LEFT },
          { v: purpose,                               s: STYLE_CELL_LEFT },
          { v: l.vehicle_plate || 'Walk-in',          s: STYLE_CELL_CENTER },
          { v: l.mobile_number || '—',                s: STYLE_CELL_CENTER },
          { v: visitingPerson,                        s: STYLE_CELL_LEFT },
          { v: dept,                                  s: STYLE_CELL_CENTER },
          { v: l.pass_badge_no || 'CASUAL',           s: STYLE_CELL_PASS },
          { v: formatTimeOnly(l.check_in_time),       s: STYLE_CELL_TIME },
          { v: formatSecurityName(l.logged_by_guard), s: STYLE_CELL_CENTER },
          { v: formatTimeOnly(l.check_out_time),      s: STYLE_CELL_TIME },
          { v: formatSecurityName(l.checkout_by_guard), s: STYLE_CELL_CENTER },
        ];

        rows.push(dataRow);
        currentRowIdx++;
      });
    });
  }

  // Convert array of objects to worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => r.map((c) => c.v)));

  // Apply custom cell styles to worksheet
  rows.forEach((rowObj, rIdx) => {
    rowObj.forEach((cellObj, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
      if (!ws[cellRef]) ws[cellRef] = { v: cellObj.v, t: typeof cellObj.v === 'number' ? 'n' : 's' };
      ws[cellRef].s = cellObj.s;
    });
  });

  // Set column widths
  ws['!cols'] = [
    { wch: 22 }, // Name
    { wch: 14 }, // Nationality
    { wch: 24 }, // Company Name
    { wch: 26 }, // Purpose of Visit
    { wch: 15 }, // Vehicle No.
    { wch: 18 }, // Mobile Number
    { wch: 20 }, // Visiting Person
    { wch: 18 }, // Department
    { wch: 14 }, // Pass Number
    { wch: 12 }, // Time In
    { wch: 16 }, // Security In
    { wch: 12 }, // Time Out
    { wch: 16 }, // Security Out
  ];

  ws['!merges'] = merges;

  // Freeze top 4 header rows (Title banner, Date box, Column headers stay fixed when scrolling down)
  ws['!views'] = [
    {
      state: 'frozen',
      ySplit: 4,
      topLeftCell: 'A5',
      activeCell: 'A5',
    },
  ];

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
    const pct = totalRecords > 0 ? ((count / totalRecords) * 100).toFixed(1) + '%' : '0%';
    return [
      { v: cat.name,   s: STYLE_CELL_LEFT },
      { v: count,      s: STYLE_CELL_CENTER },
      { v: inside,     s: STYLE_CELL_CENTER },
      { v: checkedOut, s: STYLE_CELL_CENTER },
      { v: ext,        s: STYLE_CELL_CENTER },
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
      { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} },
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
      { v: '', s: {} }, { v: '', s: {} },
    ]);

  const rows = [
    // Banner
    Array(6).fill(null).map((_, i) => ({ v: i === 0 ? 'HOTEL SECURITY & VISITOR ACCESS — EXECUTIVE SUMMARY REPORT' : '', s: STYLE_TITLE_BANNER })),
    Array(6).fill(null).map((_, i) => ({ v: i === 0 ? `Report Generated: ${new Date().toLocaleString()}` : '', s: STYLE_SUBTITLE_TEXT })),
    Array(6).fill(null).map(() => ({ v: '', s: {} })),

    // KPIs Header
    [
      { v: 'KEY AUDIT METRICS', s: STYLE_COLUMN_HEADER },
      { v: 'VALUE', s: STYLE_COLUMN_HEADER },
      { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} },
    ],
    [{ v: 'Total Access Entries Logged', s: STYLE_CELL_LEFT }, { v: totalRecords, s: STYLE_CELL_CENTER }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }],
    [{ v: 'Currently On Property (Active Inside)', s: STYLE_CELL_LEFT }, { v: insideCount, s: STYLE_CELL_CENTER }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }],
    [{ v: 'Total Departures (Checked Out)', s: STYLE_CELL_LEFT }, { v: checkedOutCount, s: STYLE_CELL_CENTER }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }],
    [{ v: 'Total Manager Time Extensions Granted', s: STYLE_CELL_LEFT }, { v: extensionsCount, s: STYLE_CELL_CENTER }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} }],
    Array(6).fill(null).map(() => ({ v: '', s: {} })),

    // Category Breakdown
    [
      { v: 'CATEGORY BREAKDOWN', s: STYLE_COLUMN_HEADER },
      { v: 'TOTAL ENTRIES', s: STYLE_COLUMN_HEADER },
      { v: 'CURRENTLY INSIDE', s: STYLE_COLUMN_HEADER },
      { v: 'CHECKED OUT', s: STYLE_COLUMN_HEADER },
      { v: 'EXTENSIONS', s: STYLE_COLUMN_HEADER },
      { v: 'TRAFFIC SHARE (%)', s: STYLE_COLUMN_HEADER },
    ],
    ...catRows,
    [
      { v: 'GRAND TOTAL', s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'left' } } },
      { v: totalRecords, s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center' } } },
      { v: insideCount, s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center' } } },
      { v: checkedOutCount, s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center' } } },
      { v: extensionsCount, s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center' } } },
      { v: '100.0%', s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center' } } },
    ],
    Array(6).fill(null).map(() => ({ v: '', s: {} })),

    // Department Breakdown
    [
      { v: 'DEPARTMENT DISTRIBUTION', s: STYLE_COLUMN_HEADER },
      { v: 'TOTAL VISITS', s: STYLE_COLUMN_HEADER },
      { v: 'SHARE (%)', s: STYLE_COLUMN_HEADER },
      { v: '', s: {} }, { v: '', s: {} }, { v: '', s: {} },
    ],
    ...deptRows,
    Array(6).fill(null).map(() => ({ v: '', s: {} })),

    // Security Guards Activity
    [
      { v: 'SECURITY OFFICER', s: STYLE_COLUMN_HEADER },
      { v: 'CHECK-INS LOGGED', s: STYLE_COLUMN_HEADER },
      { v: 'CHECK-OUTS LOGGED', s: STYLE_COLUMN_HEADER },
      { v: 'TOTAL OPERATIONS', s: STYLE_COLUMN_HEADER },
      { v: '', s: {} }, { v: '', s: {} },
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
    { wch: 20 },
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
  ];

  // Freeze top summary banner
  ws['!views'] = [
    {
      state: 'frozen',
      ySplit: 3,
      topLeftCell: 'A4',
      activeCell: 'A4',
    },
  ];

  return ws;
}

/**
 * Generates and downloads the complete multi-sheet styled executive workbook.
 */
export function generateProfessionalExcelReport(logs, notify) {
  const wb = XLSX.utils.book_new();

  // 1. Executive Summary Tab
  const wsSummary = buildStyledSummaryWorksheet(logs);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // 2. Daily View
  const now = new Date();
  const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);
  const todayLogs = logs.filter((l) => (l.check_in_time || '').startsWith(todayStr));
  const wsDaily = buildStyledRegisterWorksheet(
    todayLogs.length > 0 ? todayLogs : logs.slice(0, 50),
    `DAILY VIEW • Showing today's visitors (${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })})`
  );
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily View');

  // 3. Master Register
  const wsMaster = buildStyledRegisterWorksheet(logs, "MASTER REGISTER • Complete log of all visitor & security traffic.");
  XLSX.utils.book_append_sheet(wb, wsMaster, 'Master Register');

  // 4. Category Tabs
  const categories = [
    { key: 'hotel_guest_visitor',  title: 'Visitors',    subtitle: "VISITORS REGISTER • Guest, business meetings, and official visitors." },
    { key: 'contractor_engineer',  title: 'Contractors', subtitle: "CONTRACTORS REGISTER • External contractors, technicians & PTW works." },
    { key: 'supplier_delivery',    title: 'Suppliers',   subtitle: "SUPPLIERS REGISTER • Delivery trucks, materials & vendors." },
    { key: 'casual_staff_banquet', title: 'Casuals',     subtitle: "CASUAL STAFF REGISTER • F&B, Housekeeping, Stewarding & Entertainment." },
  ];

  categories.forEach(({ key, title, subtitle }) => {
    const items = logs.filter((l) => l.traffic_type === key);
    const ws = buildStyledRegisterWorksheet(items, subtitle);
    XLSX.utils.book_append_sheet(wb, ws, title);
  });

  const filename = `Visitor-Access-Security-Log-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);

  if (notify) {
    notify('✅ Professional Visitor Access & Security Log report downloaded', 'success');
  }
}
