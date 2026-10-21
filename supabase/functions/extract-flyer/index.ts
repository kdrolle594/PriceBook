// Read a flyer image. Runs server-side so the Anthropic key never reaches a
// browser. Admin-only via the same is_admin() the RLS uses.
//
// Two passes, called one after the other by the app:
//   mode "items"  — every product, size, and price (Sonnet 5.5, reads the
//                   flyer at full resolution)
//   mode "photos" — a box around each listed product's picture (Opus 5.5,
//                   most accurate at locating things). Kept separate because
//                   asking one pass for both made names and prices worse.
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

function buildPhotosPrompt(items: string[], width: number, height: number): string {
  return `This is a supermarket flyer. These products are advertised on it:
${items.map((n, i) => `${i}: ${n}`).join('\n')}

For each product, find its product picture on the flyer and give a tight box around that picture only — not the price tag, name text, or the surrounding panel.

Coordinates are pixels in this ${width}x${height} image, origin top-left.

Return ONLY compact JSON, no fences or commentary: [[index,x1,y1,x2,y2],...]
Leave out any product whose picture you can't find.`
}

const MODELS = { items: 'claude-sonnet-5-5', photos: 'claude-opus-5-5' }

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

  let image: string, mediaType: string, prompt: string, mode: 'items' | 'photos'
  try {
    const body = await req.json()
    image = body.image
    mediaType = body.mediaType || 'image/png'
    mode = body.mode === 'photos' ? 'photos' : 'items'
    if (!image) throw new Error('missing image')
    if (mode === 'photos') {
      const items = Array.isArray(body.items) ? body.items.map(String) : []
      const width = Number(body.width)
      const height = Number(body.height)
      if (!items.length || !(width > 0) || !(height > 0)) throw new Error('missing items or size')
      prompt = buildPhotosPrompt(items, Math.round(width), Math.round(height))
    } else {
      prompt = buildPrompt(Array.isArray(body.knownCanonicals) ? body.knownCanonicals : [])
    }
  } catch {
    return json({ error: 'Bad request — expected {image, mediaType, knownCanonicals} or {mode: "photos", image, mediaType, items, width, height}' }, 400)
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // a declined request is retried on Anthropic's recommended model
      'anthropic-beta': 'server-side-fallback-2026-07-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODELS[mode],
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      fallbacks: 'default',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: prompt },
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
  if (data.stop_reason === 'refusal') {
    return json({ error: 'The scan was declined. Try a clearer photo of the flyer.' }, 502)
  }
  const text = (data.content || [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n')

  return json({ text })
})
