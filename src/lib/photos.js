import { supabase } from './supabase.js'

const BUCKET = 'item-photos'
const MAX_SIDE = 320 // thumbnails only — keeps each photo around 15–30 KB
const PAD = 0.03     // grow AI boxes a little so tight boxes don't clip the product

// The scan returns each item as [canonical, display, size, price, x1, y1, x2, y2]
// with the box in 0–1000 units of the image. Returns [x1, y1, x2, y2] or null.
export function rowBox(row) {
  if (!Array.isArray(row) || row.length < 8) return null
  const box = row.slice(4, 8).map(Number)
  if (box.some(n => !Number.isFinite(n))) return null
  const [x1, y1, x2, y2] = box.map(n => Math.min(1000, Math.max(0, n)))
  if (x2 - x1 < 5 || y2 - y1 < 5) return null
  return [x1, y1, x2, y2]
}

// Box in 0–1000 units → pixel rect on an image of w×h, padded and clamped.
export function boxToRect(box, w, h, pad = PAD) {
  const [x1, y1, x2, y2] = box
  const px = (x2 - x1) * pad
  const py = (y2 - y1) * pad
  const left = Math.max(0, ((x1 - px) / 1000) * w)
  const top = Math.max(0, ((y1 - py) / 1000) * h)
  const right = Math.min(w, ((x2 + px) / 1000) * w)
  const bottom = Math.min(h, ((y2 + py) / 1000) * h)
  return { x: left, y: top, w: right - left, h: bottom - top }
}

function toJpeg(source, rect) {
  const scale = Math.min(1, MAX_SIDE / Math.max(rect.w, rect.h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(rect.w * scale))
  canvas.height = Math.max(1, Math.round(rect.h * scale))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // transparent PNG screenshots would turn black
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not make photo'))), 'image/jpeg', 0.82)
  )
}

// Cut one item's photo out of the flyer. `pad` is 0 for boxes a person drew.
export async function cropPhoto(file, box, pad = PAD) {
  const bmp = await createImageBitmap(file)
  try {
    return await toJpeg(bmp, boxToRect(box, bmp.width, bmp.height, pad))
  } finally {
    bmp.close()
  }
}

// A photo picked or taken by an admin, shrunk to thumbnail size.
export async function shrinkPhoto(file) {
  const bmp = await createImageBitmap(file)
  try {
    return await toJpeg(bmp, { x: 0, y: 0, w: bmp.width, h: bmp.height })
  } finally {
    bmp.close()
  }
}

// New file name per upload, so browsers never show a stale cached photo.
export async function uploadPhoto(itemId, blob) {
  const path = `${itemId}/${Date.now()}.jpg`
  await supabase.storage.from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
    .then(({ error }) => { if (error) throw error })
  return path
}

export async function deletePhoto(path) {
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

export function photoUrl(path) {
  if (!path || !supabase) return ''
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
