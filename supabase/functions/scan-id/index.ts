import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageBase64 } = await req.json()
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing GOOGLE_CLOUD_VISION_API_KEY secret' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Clean base64 string if it contains data URI header
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: cleanBase64 },
              features: [{ type: 'TEXT_DETECTION' }]
            }
          ]
        })
      }
    )

    const visionData = await visionRes.json()
    const rawText = visionData.responses?.[0]?.fullTextAnnotation?.text || ''

    // Parse Emirates ID / Passport formats
    const eidMatch = rawText.match(/(?:784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d{1}|\b784\d{15}\b)/)
    const mrzMatch = rawText.match(/P<([A-Z]{3})([A-Z0-9<]+)/)

    return new Response(
      JSON.stringify({
        success: true,
        rawText,
        extracted: {
          docNumber: eidMatch ? eidMatch[0].replace(/\s+/g, '') : '',
          rawText
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
