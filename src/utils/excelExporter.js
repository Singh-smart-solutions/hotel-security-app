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
 * Matches the exact executive format: Title Banner, Subtitle, Column Headers, Date Grouping Banners, and clean cells.
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

  // 1. Title Banner & Subheader Rows
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

  // 2. Data rows grouped with Date Banners
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
        // Parse department & visiting person/area
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

        // Clean purpose of visit
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

  // Professional column widths adjusted for clean presentation
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

  // Merge Row 1 across columns A-M
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }, // Row 1 Title Banner
    { s: { r: 1, c: 4 }, e: { r: 1, c: 12 } }, // Row 2 Subtitle
  ];

  return ws;
}

/**
 * Generates and downloads the complete multi-sheet executive security workbook.
 */
export function generateProfessionalExcelReport(logs, notify) {
  const wb = XLSX.utils.book_new();

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

  // Summary Overview Sheet
  const insideCount = logs.filter((l) => l.status === 'inside').length;
  const checkedOutCount = logs.filter((l) => l.status === 'checked_out').length;
  const extendedCount = logs.filter((l) => l.purpose_of_visit?.includes('[Ext')).length;

  const summaryAoa = [
    ['HOTEL SECURITY & VISITOR ACCESS MASTER REPORT', ''],
    [`Generated Date: ${new Date().toLocaleString()}`, ''],
    ['', ''],
    ['CATEGORY BREAKDOWN', 'TOTAL COUNT'],
    ['Visitors (Guest & Official)', logs.filter((l) => l.traffic_type === 'hotel_guest_visitor').length],
    ['Contractors & Engineers', logs.filter((l) => l.traffic_type === 'contractor_engineer').length],
    ['Suppliers & Deliveries', logs.filter((l) => l.traffic_type === 'supplier_delivery').length],
    ['Casual Staff', logs.filter((l) => l.traffic_type === 'casual_staff_banquet').length],
    ['TOTAL LOGGED ENTRIES', logs.length],
    ['', ''],
    ['STATUS AUDIT OVERVIEW', 'COUNT'],
    ['Currently On Property (Inside)', insideCount],
    ['Successfully Checked Out', checkedOutCount],
    ['Manager Extensions Approved', extendedCount],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 18 }];
  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  const filename = `Visitor-Access-Security-Log-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);

  if (notify) {
    notify('✅ Professional Visitor Access & Security Log report downloaded', 'success');
  }
}
