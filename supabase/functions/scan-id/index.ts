const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
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

    const apiKey = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY')
    if (!apiKey) {
      console.error('Missing GOOGLE_CLOUD_VISION_API_KEY')
      return new Response(
        JSON.stringify({ error: 'Google Vision API Key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Strip any data-URI header so we send Vision raw base64.
    const cleanBase64 = rawImage.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim()

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: cleanBase64 },
              // DOCUMENT_TEXT_DETECTION is far more reliable for the dense,
              // fixed-pitch text of ID cards and passport MRZ lines.
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
            }
          ]
        })
      }
    )

    const visionData = await visionRes.json()
    if (!visionRes.ok || visionData.error) {
      const message = visionData?.error?.message || `Vision API error: ${visionRes.status}`
      console.error('Vision API Error:', message)
      return new Response(
        JSON.stringify({ error: message }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rawText: string = visionData.responses?.[0]?.fullTextAnnotation?.text || ''

    if (!rawText.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No text recognized. Hold the document steady with good lighting.',
          extracted: null
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
      rawText
    }

    // Vision often reads the MRZ with stray spaces; collapse them for MRZ matching.
    const mrzText = rawText.replace(/ /g, '')

    // 1. Emirates ID number: 784-YYYY-XXXXXXX-X (15 digits: 784 + 12).
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

    // 2. Passport MRZ line 1 (TD3): P<ISSSURNAME<<GIVEN<NAMES
    const passportLine1 = mrzText.match(/P[<K]([A-Z]{3})([A-Z<]+)/)
    if (passportLine1) {
      extracted.docType = 'passport'
      extracted.nationality = passportLine1[1]
      const parts = passportLine1[2].split('<<')
      const surname = (parts[0] || '').replace(/</g, ' ').trim()
      const given = (parts[1] || '').replace(/</g, ' ').trim()
      extracted.fullName = `${given} ${surname}`.replace(/\s+/g, ' ').trim()
    }

    // 3. Passport MRZ line 2: number(9) check nat(3) DOB(6) check sex expiry(6)...
    if (extracted.docType === 'passport') {
      const line2 = mrzText.match(/([A-Z0-9<]{9})[0-9]([A-Z]{3})([0-9]{6})[0-9]([MFX<])([0-9]{6})/)
      if (line2) {
        extracted.docNumber = line2[1].replace(/</g, '')
        if (!extracted.nationality) extracted.nationality = line2[2]
        const yy = parseInt(line2[5].substring(0, 2), 10)
        // MRZ years are two digits; treat 00-49 as 2000s, 50-99 as 1900s.
        const yr = yy <= 49 ? 2000 + yy : 1900 + yy
        const mo = line2[5].substring(2, 4)
        const da = line2[5].substring(4, 6)
        extracted.expiryDate = `${yr}-${mo}-${da}`
      }
    }

    // 4. Date fallback (DD/MM/YYYY or DD-MM-YYYY) — pick the latest as expiry.
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

    // 5. Expiry check.
    if (extracted.expiryDate) {
      const exp = new Date(`${extracted.expiryDate}T00:00:00`).getTime()
      if (!isNaN(exp) && exp < Date.now()) {
        extracted.isExpired = true
      }
    }

    // 6. Name for Emirates ID (English "Name" label, value on the next line).
    if (extracted.docType === 'emirates_id' && !extracted.fullName) {
      const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      const nIdx = lines.findIndex((l) => /^name\b|name:|nom/i.test(l))
      if (nIdx !== -1 && lines[nIdx + 1]) {
        extracted.fullName = lines[nIdx + 1].replace(/[^a-zA-Z\s]/g, '').trim()
      }
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
