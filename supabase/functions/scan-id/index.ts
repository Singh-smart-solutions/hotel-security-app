const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ScanResult = {
  fullName: string;
  docNumber: string;
  nationality: string;
  expiryDate: string;
  docType: 'passport' | 'emirates_id' | 'unknown';
};

const emptyResult = (): ScanResult => ({
  fullName: '',
  docNumber: '',
  nationality: '',
  expiryDate: '',
  docType: 'unknown',
});

const cleanText = (value: string) => value.toUpperCase().replace(/[\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim();

const toIsoDate = (day: string, month: string, year: string) => {
  const fullYear = year.length === 2 ? `20${year}` : year;
  if (!day || !month || !fullYear) return '';
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const parseMrz = (text: string, result: ScanResult) => {
  const lines = text.split(/\r?\n/).map(line => line.replace(/\s/g, '').toUpperCase()).filter(Boolean);
  for (let index = 0; index < lines.length - 1; index += 1) {
    const nameLine = lines[index];
    const dataLine = lines[index + 1];
    if (!nameLine.includes('<<') || nameLine.length < 30 || dataLine.length < 40) continue;
    if (!/^[PI][<A-Z]/.test(nameLine) || !/^\w[A-Z0-9<]{38,}$/.test(dataLine)) continue;

    const names = nameLine.slice(5).split('<<');
    result.fullName = names
      .reverse()
      .join(' ')
      .replace(/<+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    result.docNumber = dataLine.slice(0, 9).replace(/</g, '');
    result.nationality = dataLine.slice(10, 13).replace(/</g, '');
    result.expiryDate = toIsoDate(dataLine.slice(25, 27), dataLine.slice(23, 25), dataLine.slice(21, 23));
    result.docType = 'passport';
    return true;
  }
  return false;
};

const parseCardText = (text: string, result: ScanResult) => {
  const normalized = cleanText(text);
  const idMatch = normalized.match(/784[- ]?\d{4}[- ]?\d{7}[- ]?\d/);
  const compactIdMatch = normalized.match(/\b784\d{12}\b/);
  result.docNumber = (idMatch?.[0] || compactIdMatch?.[0] || '').replace(/[ -]/g, '');

  const expiryMatch = normalized.match(/(?:EXPIRY|EXPIRATION|DATE OF EXPIRY)[^0-9]*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (expiryMatch) result.expiryDate = toIsoDate(expiryMatch[1], expiryMatch[2], expiryMatch[3]);

  const nationalityMatch = normalized.match(/(?:NATIONALITY|COUNTRY)[^A-Z]*([A-Z]{3})/);
  result.nationality = nationalityMatch?.[1] || '';

  const nameMatch = normalized.match(/(?:FULL NAME|NAME)[\s:]+([A-Z][A-Z .'-]{3,})/);
  result.fullName = nameMatch?.[1]?.replace(/\s+/g, ' ').trim() || '';
  if (result.docNumber) result.docType = 'emirates_id';
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await request.json();
    const image = typeof body.image === 'string' ? body.image.replace(/^data:image\/[^;]+;base64,/, '') : '';
    if (!image) throw new Error('Missing base64 image');

    const apiKey = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY');
    if (!apiKey) throw new Error('GOOGLE_CLOUD_VISION_API_KEY is not configured');

    const visionResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ image: { content: image }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }] }),
    });
    if (!visionResponse.ok) throw new Error(`Vision API returned ${visionResponse.status}`);
    const visionPayload = await visionResponse.json();
    const text = visionPayload.responses?.[0]?.fullTextAnnotation?.text || '';
    const result = emptyResult();
    if (!parseMrz(text, result)) parseCardText(text, result);

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Scan failed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
