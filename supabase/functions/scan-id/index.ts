const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ExtractedIdentity {
  docNumber: string
  fullName: string
  nationality: string
  expiryDate: string
  isExpired: boolean
  docType: 'emirates_id' | 'passport' | 'unknown'
  rawText: string
}

// ISO 3166-1 alpha-3 → readable nationality for passport MRZ codes
const COUNTRY_CODES: Record<string, string> = {
  IND: 'Indian',     PAK: 'Pakistani',   PHL: 'Filipino',     BGD: 'Bangladeshi',
  NPL: 'Nepali',     LKA: 'Sri Lankan',  EGY: 'Egyptian',     JOR: 'Jordanian',
  GBR: 'British',    USA: 'American',    CAN: 'Canadian',     AUS: 'Australian',
  FRA: 'French',     DEU: 'German',      CHN: 'Chinese',      KOR: 'Korean',
  THA: 'Thai',       IDN: 'Indonesian',  MYS: 'Malaysian',    VNM: 'Vietnamese',
  ARE: 'Emirati',    SAU: 'Saudi',       KWT: 'Kuwaiti',      BHR: 'Bahraini',
  QAT: 'Qatari',     OMN: 'Omani',       TUR: 'Turkish',      IRN: 'Iranian',
  ETH: 'Ethiopian',  KEN: 'Kenyan',      NGA: 'Nigerian',     GHA: 'Ghanaian',
  MAR: 'Moroccan',   DZA: 'Algerian',    TUN: 'Tunisian',     LBN: 'Lebanese',
  SYR: 'Syrian',     IRQ: 'Iraqi',       YEM: 'Yemeni',       SOM: 'Somali',
  SDN: 'Sudanese',   TZA: 'Tanzanian',   UGA: 'Ugandan',      ZMB: 'Zambian',
  ZWE: 'Zimbabwean', CMR: 'Cameroonian', CIV: 'Ivorian',      SEN: 'Senegalese',
  JPN: 'Japanese',   KHM: 'Cambodian',   MMR: 'Burmese',      AFG: 'Afghan',
  UZB: 'Uzbek',      KAZ: 'Kazakh',      AZE: 'Azerbaijani',  ARM: 'Armenian',
  GEO: 'Georgian',   MDV: 'Maldivian',   RUS: 'Russian',      UKR: 'Ukrainian',
  POL: 'Polish',     ITA: 'Italian',     ESP: 'Spanish',      PRT: 'Portuguese',
  NLD: 'Dutch',      BEL: 'Belgian',     CHE: 'Swiss',        AUT: 'Austrian',
  SWE: 'Swedish',    NOR: 'Norwegian',   DNK: 'Danish',       FIN: 'Finnish',
  GRC: 'Greek',      MEX: 'Mexican',     BRA: 'Brazilian',    COL: 'Colombian',
  ARG: 'Argentine',  CHL: 'Chilean',     PER: 'Peruvian',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = await req.json().catch(() => null)
    // Accept both `image` (current frontend) and `imageBase64` (legacy) keys.
    const rawImage: string | undefined = body?.image ?? body?.imageBase64
    if (!rawImage) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('OCR_SPACE_API_KEY')
    if (!apiKey) {
      console.error('Missing OCR_SPACE_API_KEY secret')
      return new Response(
        JSON.stringify({ error: 'OCR service not configured. Set the OCR_SPACE_API_KEY secret in Supabase.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Strip any data-URI header — OCR.space wants raw base64 with the
    // filetype declared separately, or a data-URI. We'll send a data-URI.
    let cleanBase64 = rawImage.trim()
    if (!cleanBase64.startsWith('data:')) {
      // Re-attach a JPEG data-URI prefix if the frontend stripped it.
      cleanBase64 = `data:image/jpeg;base64,${cleanBase64}`
    }

    // Build multipart/form-data for OCR.space Parse API.
    const form = new FormData()
    form.append('base64Image', cleanBase64)
    form.append('language', 'eng')
    form.append('isOverlayRequired', 'false')
    form.append('detectOrientation', 'true')
    form.append('scale', 'true')
    // OCR Engine 2 is more accurate for structured documents like IDs / passports.
    form.append('OCREngine', '2')

    const ocrRes = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { apikey: apiKey },
      body: form,
    })

    const ocrData = await ocrRes.json()

    if (!ocrRes.ok || ocrData.IsErroredOnProcessing) {
      const message = ocrData?.ErrorMessage?.[0] || ocrData?.ErrorDetails || `OCR.space error: ${ocrRes.status}`
      console.error('OCR.space Error:', message)
      return new Response(
        JSON.stringify({ error: message }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Concatenate text from all parsed pages/regions.
    const rawText: string = (ocrData.ParsedResults ?? [])
      .map((r: { ParsedText?: string }) => r.ParsedText ?? '')
      .join('\n')
      .trim()

    if (!rawText) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No text recognised. Hold the document steady with good lighting and fill the frame.',
          extracted: null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const extracted: ExtractedIdentity = {
      docNumber: '',
      fullName: '',
      nationality: '',
      expiryDate: '',
      isExpired: false,
      docType: 'unknown',
      rawText,
    }

    // OCR.space sometimes reads MRZ with stray spaces — collapse them for pattern matching.
    const mrzText = rawText.replace(/ /g, '')

    // ── 1. Emirates ID number: 784-YYYY-XXXXXXX-X (15 digits starting with 784) ──
    const eidMatch =
      rawText.match(/784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d{1}/) ||
      rawText.match(/\b784\d{12}\b/)
    if (eidMatch) {
      extracted.docType = 'emirates_id'
      let cleanId = eidMatch[0].replace(/\s+/g, '')
      if (!cleanId.includes('-') && cleanId.length === 15) {
        cleanId = `${cleanId.slice(0, 3)}-${cleanId.slice(3, 7)}-${cleanId.slice(7, 14)}-${cleanId.slice(14)}`
      }
      extracted.docNumber = cleanId
    }

    // ── 2. Passport MRZ line 1 (TD3): P<ISSSURNAME<<GIVEN<NAMES ──
    const passportLine1 = mrzText.match(/P[<K]([A-Z]{3})([A-Z<]+)/)
    if (passportLine1) {
      extracted.docType = 'passport'
      extracted.nationality = passportLine1[1]
      const parts = passportLine1[2].split('<<')
      const surname = (parts[0] || '').replace(/</g, ' ').trim()
      const given = (parts[1] || '').replace(/</g, ' ').trim()
      extracted.fullName = `${given} ${surname}`.replace(/\s+/g, ' ').trim()
    }

    // ── 3. Passport MRZ line 2: number(9) check nat(3) DOB(6) check sex expiry(6) ──
    if (extracted.docType === 'passport') {
      const line2 = mrzText.match(/([A-Z0-9<]{9})[0-9]([A-Z]{3})([0-9]{6})[0-9]([MFX<])([0-9]{6})/)
      if (line2) {
        extracted.docNumber = line2[1].replace(/</g, '')
        if (!extracted.nationality) extracted.nationality = line2[2]
        const yy = parseInt(line2[5].substring(0, 2), 10)
        const yr = yy <= 49 ? 2000 + yy : 1900 + yy
        const mo = line2[5].substring(2, 4)
        const da = line2[5].substring(4, 6)
        extracted.expiryDate = `${yr}-${mo}-${da}`
      }
      // Expand 3-letter ISO code to readable nationality
      if (extracted.nationality && COUNTRY_CODES[extracted.nationality.toUpperCase()]) {
        extracted.nationality = COUNTRY_CODES[extracted.nationality.toUpperCase()]
      }
    }

    // ── 4. Date fallback (DD/MM/YYYY or DD-MM-YYYY) — pick the latest as expiry ──
    if (!extracted.expiryDate) {
      const dates = rawText.match(/(\d{2})[/.-](\d{2})[/.-](\d{4})/g)
      if (dates && dates.length > 0) {
        const sorted = dates
          .map((d) => {
            const p = d.split(/[/.-]/)
            return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
          })
          .sort()
        extracted.expiryDate = sorted[sorted.length - 1]
      }
    }

    // ── 5. Expiry check ──
    if (extracted.expiryDate) {
      const exp = new Date(`${extracted.expiryDate}T00:00:00`).getTime()
      if (!isNaN(exp) && exp < Date.now()) {
        extracted.isExpired = true
      }
    }

    // ── 6. Name extraction for Emirates ID ──
    // Emirates ID layout: "Name: Satnam Singh Gurdev Singh" (value on SAME line as label).
    // We check same-line value first; only fall back to the next line if nothing found.
    if (extracted.docType === 'emirates_id' && !extracted.fullName) {
      const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

      // Priority 1: value is on the same line as the "Name:" label
      const nameInline = lines.find((l) => /^name\s*[:]/i.test(l) || /name\s*:/i.test(l))
      if (nameInline) {
        const afterColon = nameInline.replace(/.*name\s*:\s*/i, '').trim()
        extracted.fullName = afterColon.replace(/[^a-zA-Z\s'-]/g, '').trim()
      }

      // Priority 2: label on one line, value on the next line
      if (!extracted.fullName) {
        const nIdx = lines.findIndex((l) => /^name$/i.test(l))
        if (nIdx !== -1 && lines[nIdx + 1]) {
          extracted.fullName = lines[nIdx + 1].replace(/[^a-zA-Z\s'-]/g, '').trim()
        }
      }
    }

    // ── 7. Nationality extraction for Emirates ID ──
    // Strategy A: broad inline regex (handles OCR misspellings like "Nationaiity", "Nationailty")
    if (extracted.docType === 'emirates_id' && !extracted.nationality) {
      const inlineMatch = rawText.match(/nation[a-z]{0,6}\s*[:/]?\s*([a-z][a-z ]{1,20})/i)
      if (inlineMatch && inlineMatch[1]) {
        const candidate = inlineMatch[1].trim().split(/\s+/)[0] // take first word
        if (candidate.length > 1 && !/date|birth|expiry|issue|gender|sex|sign|united|arab/i.test(candidate)) {
          extracted.nationality = candidate
        }
      }
    }

    // Strategy B: line-by-line — find label, read same line or next line
    if (extracted.docType === 'emirates_id' && !extracted.nationality) {
      const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      const natIdx = lines.findIndex((l) => /nation/i.test(l))
      if (natIdx !== -1) {
        const afterKeyword = lines[natIdx]
          .replace(/.*nation\w*\s*[:/]?\s*/i, '')
          .replace(/[^a-zA-Z\s]/g, '')
          .trim()
        if (afterKeyword.length > 1 && !/date|birth|expiry|issue|sex|sign|united|arab/i.test(afterKeyword)) {
          extracted.nationality = afterKeyword.split(/\s+/)[0]
        } else if (natIdx + 1 < lines.length) {
          const nextLine = lines[natIdx + 1].replace(/[^a-zA-Z\s]/g, '').trim()
          const looksLikeLabel = /date|birth|expiry|issuing|sex|gender|sign|united|arab/i.test(nextLine)
          if (nextLine.length > 1 && !looksLikeLabel) {
            extracted.nationality = nextLine.split(/\s+/)[0]
          }
        }
      }
    }

    // Strategy C: Emirates ID back — TD1 MRZ format
    // Line 2 pattern: YYMMDD(C)(Sex)YYMMDD(C)(NAT3)(optional)
    if (extracted.docType === 'emirates_id' && !extracted.nationality) {
      const td1L2 = mrzText.match(/\d{6}\d[MFX<]\d{6}\d([A-Z<]{3})/)
      if (td1L2) {
        const nat = td1L2[1].replace(/</g, '').trim()
        if (nat.length >= 2) extracted.nationality = COUNTRY_CODES[nat] || nat
        // Also grab expiry from TD1 if not yet set
        const td1Exp = mrzText.match(/\d{6}\d[MFX<](\d{6})\d/)
        if (td1Exp && !extracted.expiryDate) {
          const raw = td1Exp[1]
          const yy2 = parseInt(raw.substring(0, 2), 10)
          const yr2 = yy2 <= 49 ? 2000 + yy2 : 1900 + yy2
          extracted.expiryDate = `${yr2}-${raw.substring(2, 4)}-${raw.substring(4, 6)}`
        }
      }
    }

    // Final step: expand any remaining 3-letter ISO code (e.g. IND → Indian)
    if (extracted.nationality) {
      const code = extracted.nationality.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
      if (COUNTRY_CODES[code]) extracted.nationality = COUNTRY_CODES[code]
    }


    return new Response(
      JSON.stringify({ success: true, extracted }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Function execution error:', err instanceof Error ? err.message : err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
