import { supabase } from './supabase.js'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result.split(',')[1])
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsDataURL(file)
  })
}

export function parseResponse(text) {
  let clean = text.replace(/```json|```/g, '').trim()
  clean = clean.replace(/\$\s*(\d)/g, '$1') // model sometimes writes $5.00 — strip the $
  try {
    return JSON.parse(clean)
  } catch {
    // Response was cut off — salvage the complete items before the cutoff
    const cut = clean.lastIndexOf('],')
    if (cut === -1) throw new Error('Could not read any items')
    return JSON.parse(clean.slice(0, cut + 1) + ']}')
  }
}

/**
 * Extract prices from one flyer image via the extract-flyer Edge Function —
 * the Anthropic key lives server-side and the function checks is_admin().
 * @param {File} file - the flyer photo/screenshot
 * @param {string[]} knownCanonicals - existing item canonicals to reuse
 * @returns {Promise<{s: string, d: string, e: string, i: Array}>}
 */
export async function extractFlyer(file, knownCanonicals) {
  const image = await fileToBase64(file)

  const { data, error } = await supabase.functions.invoke('extract-flyer', {
    body: { image, mediaType: file.type || 'image/png', knownCanonicals },
  })

  if (error) {
    // FunctionsHttpError carries the function's JSON body on .context
    let message = error.message
    try {
      const body = await error.context?.json()
      if (body?.error) message = body.error
    } catch { /* keep the generic message */ }
    if (/Failed to send a request/i.test(message)) {
      message = 'Could not reach the extract-flyer function — is it deployed? (supabase functions deploy extract-flyer)'
    }
    throw new Error(message)
  }

  const parsed = parseResponse(data.text || '')
  if (!(parsed.i || []).length) throw new Error('No items found in that image')
  return parsed
}
