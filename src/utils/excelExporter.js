import * as XLSX from 'xlsx';

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

/**
 * Builds a professionally formatted worksheet for a given category of logs.
 */
function buildCategoryWorksheet(items, categoryTitle) {
  // Sort chronologically
  const sorted = [...items].sort((a, b) => new Date(a.check_in_time) - new Date(b.check_in_time));

  // Group by date (day rollover)
  const dateGroups = {};
  sorted.forEach((l) => {
    const dStr = formatDateBanner(l.check_in_time);
    if (!dateGroups[dStr]) dateGroups[dStr] = [];
    dateGroups[dStr].push(l);
  });

  const todayDisplay = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const aoaData = [
    // Row 1: Title Banner
    ['VISITOR ACCESS & SECURITY LOG', '', '', '', '', '', '', '', '', '', '', '', ''],
    // Row 2: Subheader Row
    ['SELECT / ENTER DATE:', todayDisplay, '', '', `REGISTER: ${categoryTitle.toUpperCase()} • Daily security log report`, '', '', '', '', '', '', '', ''],
    // Row 3: Blank separator
    ['', '', '', '', '', '', '', '', '', '', '', '', ''],
    // Row 4: Column Headers
    [
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
    ],
  ];

  const dateKeys = Object.keys(dateGroups);
  if (dateKeys.length === 0) {
    aoaData.push(['No records recorded for this category', '', '', '', '', '', '', '', '', '', '', '', '']);
  } else {
    dateKeys.forEach((dateBanner) => {
      // Date Separator Banner Row
      aoaData.push([
        '', '', '', '', '',
        `─── ${dateBanner} ───`,
        '', '', '', '', '', '', ''
      ]);

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

        aoaData.push([
          l.full_name || '—',
          l.nationality || '—',
          l.company_name || '—',
          purpose,
          l.vehicle_plate || 'Walk-in',
          l.mobile_number || '—',
          visitingPerson,
          dept,
          l.pass_badge_no || 'CASUAL',
          formatTimeOnly(l.check_in_time),
          formatSecurityName(l.logged_by_guard),
          formatTimeOnly(l.check_out_time),
          formatSecurityName(l.checkout_by_guard),
        ]);
      });
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(aoaData);

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

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
    { s: { r: 1, c: 4 }, e: { r: 1, c: 12 } },
  ];

  return ws;
}

/**
 * Builds a comprehensive Executive Summary sheet with category breakdown, department distribution, and grand totals.
 */
function buildExecutiveSummaryWorksheet(logs) {
  const totalRecords = logs.length;
  const insideCount = logs.filter((l) => l.status === 'inside').length;
  const checkedOutCount = logs.filter((l) => l.status === 'checked_out').length;
  const extensionsCount = logs.filter((l) => l.purpose_of_visit?.includes('[Ext')).length;

  // Category metrics
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
    return [cat.name, count, inside, checkedOut, ext, pct];
  });

  // Department breakdown
  const deptCounts = {};
  logs.forEach((l) => {
    let d = (l.host_room_or_dept || 'General').split('(Visiting:')[0].split('— Area:')[0].trim();
    if (!d) d = 'General';
    deptCounts[d] = (deptCounts[d] || 0) + 1;
  });

  const deptRows = Object.entries(deptCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([dept, count]) => [
      dept,
      count,
      totalRecords > 0 ? ((count / totalRecords) * 100).toFixed(1) + '%' : '0%',
    ]);

  // Security guard actions
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
      guard,
      act.checkIns,
      act.checkOuts,
      act.checkIns + act.checkOuts,
    ]);

  const summaryAoa = [
    // Header Banner
    ['HOTEL SECURITY & VISITOR ACCESS — EXECUTIVE SUMMARY REPORT', '', '', '', '', ''],
    [`Report Generated: ${new Date().toLocaleString()}`, '', '', '', '', ''],
    ['', '', '', '', '', ''],

    // Key KPIs Table
    ['KEY AUDIT METRICS', 'VALUE', '', '', '', ''],
    ['Total Access Entries Logged', totalRecords, '', '', '', ''],
    ['Currently On Property (Active Inside)', insideCount, '', '', '', ''],
    ['Total Departures (Checked Out)', checkedOutCount, '', '', '', ''],
    ['Total Manager Time Extensions Granted', extensionsCount, '', '', '', ''],
    ['', '', '', '', '', ''],

    // Table 1: Category Breakdown
    ['CATEGORY BREAKDOWN', 'TOTAL ENTRIES', 'CURRENTLY INSIDE', 'CHECKED OUT', 'EXTENSIONS', 'TRAFFIC SHARE (%)'],
    ...catRows,
    [
      'GRAND TOTAL',
      totalRecords,
      insideCount,
      checkedOutCount,
      extensionsCount,
      '100.0%',
    ],
    ['', '', '', '', '', ''],

    // Table 2: Department Distribution
    ['DEPARTMENT DISTRIBUTION', 'TOTAL VISITS', 'SHARE (%)', '', '', ''],
    ...deptRows,
    ['', '', '', '', '', ''],

    // Table 3: Security Officer Activity
    ['SECURITY OFFICER', 'CHECK-INS LOGGED', 'CHECK-OUTS LOGGED', 'TOTAL OPERATIONS', '', ''],
    ...guardRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(summaryAoa);

  ws['!cols'] = [
    { wch: 45 }, // Category / Dept / Guard Name
    { wch: 18 }, // Total Entries / Check-ins
    { wch: 20 }, // Currently Inside / Check-outs
    { wch: 16 }, // Checked Out / Total
    { wch: 15 }, // Extensions
    { wch: 20 }, // Share (%)
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
  ];

  return ws;
}

/**
 * Generates and downloads the complete multi-sheet executive security workbook.
 */
export function generateProfessionalExcelReport(logs, notify) {
  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet as the first executive tab
  const wsSummary = buildExecutiveSummaryWorksheet(logs);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // 2. Individual Category Sheets
  const categories = [
    { key: 'hotel_guest_visitor',  title: 'Visitors' },
    { key: 'contractor_engineer',  title: 'Contractors' },
    { key: 'supplier_delivery',    title: 'Suppliers' },
    { key: 'casual_staff_banquet', title: 'Casuals' },
    { key: 'all',                  title: 'Master Register' },
  ];

  categories.forEach(({ key, title }) => {
    const items = key === 'all' ? logs : logs.filter((l) => l.traffic_type === key);
    const ws = buildCategoryWorksheet(items, title);
    XLSX.utils.book_append_sheet(wb, ws, title);
  });

  const filename = `Visitor-Access-Security-Log-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);

  if (notify) {
    notify('✅ Comprehensive Visitor Access Log & Summary report downloaded', 'success');
  }
}
