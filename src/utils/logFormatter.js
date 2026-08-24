/**
 * Parses structured security log fields for clean, rich presentation
 * across Guard Terminal, Manager Portal, and Excel Exporter.
 */
export function parseLogDetails(log) {
  if (!log) return {};

  const deptRaw = log.host_room_or_dept || '';
  const purposeRaw = log.purpose_of_visit || '';

  // 1. Parse Extension Details
  const isExtended = purposeRaw.includes('[Ext');
  let extHours = '';
  let extReason = '';
  let extApprover = '';

  if (isExtended) {
    const extMatch = purposeRaw.match(/\[Ext\s*(\+?[0-9.]+)h?\s*\|\s*Reason:\s*([^|]+)\|\s*Approved By:\s*([^\]]+)\]/i);
    if (extMatch) {
      extHours = extMatch[1].trim();
      extReason = extMatch[2].trim();
      extApprover = extMatch[3].trim().replace(/\(Manager Portal\)/i, '').trim();
    }
  }

  // Clean purpose without extension tag
  const cleanPurpose = purposeRaw.replace(/\[Ext[^\]]+\]/g, '').trim();

  // 2. Parse Host & Visiting Department (for Visitors & General)
  let department = deptRaw;
  let visitingPerson = '';

  if (deptRaw.includes('(Visiting:')) {
    const parts = deptRaw.split('(Visiting:');
    department = parts[0].trim();
    visitingPerson = parts[1].replace(')', '').trim();
  }

  // 3. Parse Contractor Work Details
  let workArea = '';
  let workPermit = '';
  let workKind = '';
  let workDescription = '';

  if (deptRaw.includes('— Area:')) {
    const parts = deptRaw.split('— Area:');
    department = parts[0].trim();
    workArea = parts[1].trim();
  }

  // Match Pattern A: "Contractor: Electrical (PTW: Wp-02) - Description"
  const contractorMatch = cleanPurpose.match(/Contractor:\s*([^(]+?)\s*\(PTW:\s*([^)]+)\)\s*(?:-\s*(.*))?/i);
  if (contractorMatch) {
    workKind = contractorMatch[1].trim();
    workPermit = contractorMatch[2].trim();
    workDescription = (contractorMatch[3] || '').trim();
  } else {
    // Match Pattern B: "Kind: Electrical | PTW: 405 | Desc: Chiller"
    const kindMatch = cleanPurpose.match(/Kind:\s*([^|]+)/i);
    const ptwMatch  = cleanPurpose.match(/PTW:\s*([^|)\n]+)/i);
    const descMatch = cleanPurpose.match(/Desc:\s*(.*)/i);

    if (kindMatch) workKind = kindMatch[1].trim();
    if (ptwMatch)  workPermit = ptwMatch[1].trim();
    if (descMatch) workDescription = descMatch[1].trim();
  }

  // If contractor and workKind is still empty, cleanPurpose is workKind
  if (log.traffic_type === 'contractor_engineer' && !workKind) {
    workKind = cleanPurpose.replace(/^Contractor:\s*/i, '').trim() || 'General Work';
  }

  return {
    department: department || 'General',
    visitingPerson,
    workArea,
    workPermit,
    workKind,
    workDescription,
    cleanPurpose: cleanPurpose || (log.traffic_type === 'supplier_delivery' ? 'Delivery' : 'Standard Entry'),
    isExtended,
    extHours,
    extReason,
    extApprover,
  };
}
