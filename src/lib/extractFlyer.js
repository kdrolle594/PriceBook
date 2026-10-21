import { supabase } from './supabase.js'

// The scan models read images up to this long edge; anything bigger gets
// shrunk server-side, which would throw off pixel boxes. Shrink it here so
// the box coordinates match the image we sent.
const MAX_EDGE = 2576

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result.split(',')[1])
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsDataURL(blob)
  })
}

async function prepareImage(file) {
  const bmp = await createImageBitmap(file)
  try {
    const { width, height } = bmp
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
    if (scale === 1) {
      return { image: await blobToBase64(file), mediaType: file.type || 'image/png', width, height }
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9))
    return { image: await blobToBase64(blob), mediaType: 'image/jpeg', width: canvas.width, height: canvas.height }
  } finally {
    bmp.close()
  }
}

// Photo-pass reply: [[index, x1, y1, x2, y2], ...] in pixels of the sent image.
export function parseBoxes(text) {
  const clean = text.replace(/```json|```/g, '').trim()
  const start = clean.indexOf('[')
  const end = clean.lastIndexOf(']')
  if (start === -1 || end <= start) return []
  try {
    const rows = JSON.parse(clean.slice(start, end + 1))
    return Array.isArray(rows) ? rows.filter(r => Array.isArray(r) && r.length === 5 && r.every(Number.isFinite)) : []
  } catch {
    return []
  }
}

// Append each pixel box to its item row as 0–1000 units of the image, the
// shape rowBox() reads: [canonical, display, size, price, x1, y1, x2, y2].
export function attachBoxes(items, boxes, width, height) {
  const out = items.map(r => r.slice(0, 4))
  const norm = (v, size) => Math.round(Math.min(1000, Math.max(0, (v / size) * 1000)))
  for (const [i, x1, y1, x2, y2] of boxes) {
    if (!out[i] || out[i].length > 4) continue
    out[i].push(norm(x1, width), norm(y1, height), norm(x2, width), norm(y2, height))
  }
  return out
}

export function parseResponse(text) {
  let clean = text.replace(/```json|```/g, '').trim()
  clean = clean.replace(/\$\s*(\d)/g, '$1') // model sometimes writes $5.00 — strip the $
  try {
    return JSON.parse(clean)
  } catch {
    return salvage(clean)
  }
}

// The model sometimes truncates mid-item or emits a single malformed item
// (unescaped inch-mark in a size like 12", or a "2/5.00" price). Recover the
// header fields plus every item that parses on its own; drop only broken ones.
function salvage(clean) {
  const field = (key) => new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`).exec(clean)?.[1] ?? ''
  const itemsStart = clean.search(/"i"\s*:/)
  const body = itemsStart === -1 ? clean : clean.slice(itemsStart)
  const i = []
  for (const [candidate] of body.matchAll(/\[(?:[^[\]"]|"(?:[^"\\]|\\.)*")*\]/g)) {
    try {
      const item = JSON.parse(candidate)
      if (Array.isArray(item) && typeof item[0] === 'string') i.push(item)
    } catch { /* skip the malformed item */ }
  }
  if (!i.length) throw new Error('Could not read any items')
  return { s: field('s'), d: field('d'), e: field('e'), i }
}

async function invoke(body) {
  const { data, error } = await supabase.functions.invoke('extract-flyer', { body })

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
  return data.text || ''
}

/**
 * Read one flyer image via the extract-flyer Edge Function — the Anthropic
 * key lives server-side and the function checks is_admin(). Prices first,
 * then a second pass that boxes each item's photo; if that pass fails the
 * flyer still comes back, just without photos.
 * @param {File} file - the flyer photo/screenshot
 * @param {string[]} knownCanonicals - existing item canonicals to reuse
 * @param {(step: 'prices' | 'photos') => void} [onStep] - progress callback
 * @returns {Promise<{s: string, d: string, e: string, i: Array}>}
 */
export async function extractFlyer(file, knownCanonicals, onStep = () => {}) {
  const { image, mediaType, width, height } = await prepareImage(file)

  onStep('prices')
  const parsed = parseResponse(await invoke({ image, mediaType, knownCanonicals }))
  if (!(parsed.i || []).length) throw new Error('No items found in that image')

  onStep('photos')
  try {
    const items = parsed.i.map(r => `${r[1] || r[0]} ${r[2] || ''}`.trim())
    const boxes = parseBoxes(await invoke({ mode: 'photos', image, mediaType, items, width, height }))
    parsed.i = attachBoxes(parsed.i, boxes, width, height)
  } catch {
    parsed.i = parsed.i.map(r => r.slice(0, 4)) // photos are optional; add them by hand
  }
  return parsed
}
