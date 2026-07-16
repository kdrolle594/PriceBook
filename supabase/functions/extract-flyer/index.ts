// Extract prices from a flyer image. Runs server-side so the Anthropic key
// never reaches a browser. Admin-only via the same is_admin() the RLS uses.
//
// Deploy:  supabase functions deploy extract-flyer
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildPrompt(knownCanonicals: string[]): string {
  return `Extract every product and price from this supermarket flyer.

Return ONLY compact JSON, no markdown fences, no commentary, no spaces or newlines:
{"s":"store name","d":"YYYY-MM-DD","e":"YYYY-MM-DD","i":[["canonical","display","size",price],...]}

Rules:
- d: flyer start date; if unreadable use today
- e: flyer end date (sale valid through); if unreadable use ""
- canonical: lowercase brand + product + size, used to match the same item across weeks. If it matches one of these existing canonicals, reuse that EXACT string:
${knownCanonicals.join('\n') || '(none yet)'}
- display: short readable name (brand + product)
- size: package size as printed (e.g. "4lbs", "12oz")
- price: bare number like 5.00 — never a $ sign, never quotes. For "2 for $3.00" style, use per-unit price (1.50). Skip unreadable prices.
- Include every item. Keep strings short.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  // Caller's JWT was already gateway-verified; check the admin flag with it
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: isAdmin, error: adminErr } = await supabase.rpc('is_admin')
  if (adminErr) return json({ error: adminErr.message }, 500)
  if (!isAdmin) return json({ error: 'Only admins can scan flyers' }, 403)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return json({ error: 'ANTHROPIC_API_KEY secret is not set — run: supabase secrets set ANTHROPIC_API_KEY=…' }, 500)
  }

  let image: string, mediaType: string, knownCanonicals: string[]
  try {
    const body = await req.json()
    image = body.image
    mediaType = body.mediaType || 'image/png'
    knownCanonicals = Array.isArray(body.knownCanonicals) ? body.knownCanonicals : []
    if (!image) throw new Error('missing image')
  } catch {
    return json({ error: 'Bad request — expected {image, mediaType, knownCanonicals}' }, 400)
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: buildPrompt(knownCanonicals) },
        ],
      }],
    }),
  })

  if (!resp.ok) {
    const detail = await resp.text()
    let message = `Anthropic API error (${resp.status})`
    try { message = JSON.parse(detail)?.error?.message || message } catch { /* keep generic */ }
    // 401/403 here mean the server secret is bad — not the caller's fault
    const status = resp.status === 429 ? 429 : 502
    return json({ error: message }, status)
  }

  const data = await resp.json()
  const text = (data.content || [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n')

  return json({ text })
})
