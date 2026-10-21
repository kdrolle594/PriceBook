import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'
import { uploadPhoto, deletePhoto } from '../lib/photos.js'

// Pre-Supabase localStorage keys — kept readable so old data can be migrated.
const LOCAL_KEYS = ['pricebook-v2', 'pricebook-v1']

// items:  [{id, canonical, display, size, photoPath, history: [{id, flyerId, store, date, endDate, price}]}]
// flyers: [{id, store, startDate, endDate, itemCount, createdAt}]
const items = ref([])
const flyers = ref([])
const loading = ref(false)

function today() {
  return new Date().toISOString().slice(0, 10)
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id || null
}

// Fetch everything and assemble the nested shape the components render.
async function loadAll() {
  loading.value = true
  try {
    const [f, it, pe] = await Promise.all([
      supabase.from('flyers').select('*').order('start_date', { ascending: false }).throwOnError(),
      supabase.from('items').select('*').throwOnError(),
      supabase.from('price_entries').select('*').throwOnError(),
    ])
    const byId = new Map(it.data.map(r => [r.id, {
      id: r.id,
      canonical: r.canonical,
      display: r.display,
      size: r.size,
      photoPath: r.photo_path || null,
      history: [],
    }]))
    for (const r of pe.data) {
      byId.get(r.item_id)?.history.push({
        id: r.id,
        flyerId: r.flyer_id,
        store: r.store,
        date: r.start_date,
        endDate: r.end_date,
        price: Number(r.price),
      })
    }
    items.value = [...byId.values()].filter(i => i.history.length > 0)
    flyers.value = f.data.map(r => ({
      id: r.id,
      store: r.store,
      startDate: r.start_date,
      endDate: r.end_date,
      itemCount: r.item_count,
      createdAt: r.created_at,
    }))
  } finally {
    loading.value = false
  }
}

// Store names come from OCR and free-text inputs, so the same store shows up
// as "WALMART ", "walmart", or with a non-breaking space. Collapse whitespace
// and reuse an existing store's spelling on a case-insensitive match so it
// never counts as a new store.
function storeKey(s) {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}
// Scans also spell one store several ways: "Cost RIGHT", "Cost Right
// Freeport", "CostRight". Treat a name as the same store when, ignoring case,
// spaces, and punctuation, it equals the start of the other name up to a word
// break, so "Cost RIGHT" matches "Cost Right Freeport" but "Max" never
// matches "Maxi".
function storeWords(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean)
}
function sameStore(a, b) {
  const [short, long] = [storeWords(a), storeWords(b)].sort((x, y) => x.length - y.length)
  const target = short.join('')
  if (!target) return false
  let joined = ''
  for (const w of long) {
    joined += w
    if (joined === target) return true
    if (joined.length >= target.length) return false
  }
  return false
}
export function normalizeStore(name, existingStores = []) {
  const cleaned = (name || '').replace(/\s+/g, ' ').trim()
  const key = cleaned.toLowerCase()
  return existingStores.find(s => storeKey(s) === key)
    || existingStores.find(s => sameStore(s, cleaned))
    || cleaned
}

// Sale window state for one entry; null when the flyer had no end date.
// `now` is injectable for tests.
export function validity(entry, now = today()) {
  if (!entry.endDate) return null
  if (entry.endDate < now) return { state: 'expired', label: 'expired' }
  const days = Math.round(
    (new Date(entry.endDate + 'T00:00:00') - new Date(now + 'T00:00:00')) / 86400000
  )
  if (days === 0) return { state: 'ending', label: 'ends today' }
  if (days === 1) return { state: 'ending', label: 'ends tomorrow' }
  if (days <= 3) return { state: 'ending', label: `ends in ${days} days` }
  const thru = new Date(entry.endDate + 'T00:00:00')
    .toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return { state: 'active', label: `valid thru ${thru}` }
}

// What this item likely costs right now: the cheapest still-running sale,
// or the most recent sighting when nothing is on sale. `now` is injectable
// for tests.
export function bestOffer(item, now = today()) {
  const active = item.history.filter(h => h.endDate && h.endDate >= now)
  if (active.length) {
    return { entry: active.reduce((a, b) => (b.price < a.price ? b : a)), onSale: true }
  }
  const entry = [...item.history].sort((a, b) => b.date.localeCompare(a.date))[0]
  return { entry, onSale: false }
}

// Where the latest price sits between the lowest and highest ever seen —
// the "shelf check" shown on every item. pct is 0 at the low, 1 at the high.
export function shelfCheck(item) {
  const prices = item.history.map(h => h.price)
  const current = [...item.history].sort((a, b) => b.date.localeCompare(a.date))[0].price
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const base = { current, min, max, count: prices.length }
  if (prices.length < 2) return { ...base, pct: null, tone: 'none', verdict: 'First price seen' }
  if (min === max) return { ...base, pct: 0.5, tone: 'flat', verdict: 'Same price every time' }
  const pct = (current - min) / (max - min)
  if (current <= min) return { ...base, pct, tone: 'low', verdict: 'Lowest price seen' }
  if (pct <= 1 / 3) return { ...base, pct, tone: 'good', verdict: 'Close to the low' }
  if (current >= max) return { ...base, pct, tone: 'high', verdict: 'Highest price seen' }
  if (pct >= 2 / 3) return { ...base, pct, tone: 'high', verdict: 'Higher than usual' }
  return { ...base, pct, tone: 'mid', verdict: 'About usual' }
}

// v1 localStorage had no flyer records — group entries by store+date into
// synthetic flyers so old data becomes per-flyer-deletable after import.
export function migrateV1(d) {
  const byKey = new Map()
  const migratedItems = (d.items || []).map(it => ({
    ...it,
    history: it.history.map(h => {
      const key = `${h.store}|${h.date}`
      let flyer = byKey.get(key)
      if (!flyer) {
        flyer = {
          id: crypto.randomUUID(),
          store: h.store,
          startDate: h.date,
          endDate: h.endDate || null,
          itemCount: 0,
          createdAt: h.date,
        }
        byKey.set(key, flyer)
      }
      flyer.itemCount++
      return { ...h, endDate: h.endDate || null, flyerId: flyer.id }
    }),
  }))
  return { items: migratedItems, flyers: [...byKey.values()] }
}

export function usePriceBook() {
  const q = ref('')
  const filter = ref('all')

  // One spelling per store, from flyers and price history alike.
  const stores = computed(() => {
    const seen = new Map()
    const all = [
      ...flyers.value.map(f => f.store),
      ...items.value.flatMap(i => i.history.map(h => h.store)),
    ]
    for (const s of all) {
      const key = storeKey(s)
      if (key && !seen.has(key)) seen.set(key, s.replace(/\s+/g, ' ').trim())
    }
    return [...seen.values()]
  })
  const dealCount = computed(() =>
    items.value.filter(i => i.history.length > 1 && isDeal(i)).length
  )
  const multiCount = computed(() =>
    items.value.filter(i => i.history.length > 1).length
  )
  const saleCount = computed(() => items.value.filter(i => activeSaleEnd(i)).length)

  // End date of the latest price's still-running sale window; null when the
  // latest price has no window or it already expired.
  function activeSaleEnd(it) {
    const cur = latest(it)
    const v = validity(cur)
    return v && v.state !== 'expired' ? cur.endDate : null
  }

  const shown = computed(() => {
    let list = items.value
    if (filter.value === 'deals') list = list.filter(i => i.history.length > 1 && isDeal(i))
    if (filter.value === 'multi') list = list.filter(i => i.history.length > 1)
    if (filter.value === 'sale') list = list.filter(i => activeSaleEnd(i))
    const query = q.value.trim().toLowerCase()
    if (query) list = list.filter(i => (i.display + ' ' + i.size).toLowerCase().includes(query))
    // Active deals first (soonest to end on top), then the old ordering.
    return [...list].sort((a, b) => {
      const ae = activeSaleEnd(a)
      const be = activeSaleEnd(b)
      if (!!ae !== !!be) return ae ? -1 : 1
      if (ae && be && ae !== be) return ae.localeCompare(be)
      return b.history.length - a.history.length || a.display.localeCompare(b.display)
    })
  })

  const sortedFlyers = computed(() =>
    [...flyers.value].sort((a, b) => b.startDate.localeCompare(a.startDate))
  )

  function sortedHist(it) {
    return [...it.history].sort((a, b) => b.date.localeCompare(a.date))
  }
  function latest(it) {
    return sortedHist(it)[0]
  }
  function minPrice(it) {
    return Math.min(...it.history.map(h => h.price))
  }
  function isDeal(it) {
    return latest(it).price <= minPrice(it)
  }
  // % change of the latest price vs the one before it; null with <2 entries
  function deltaPct(it) {
    const hist = sortedHist(it)
    if (hist.length < 2 || hist[1].price === 0) return null
    return ((hist[0].price - hist[1].price) / hist[1].price) * 100
  }

  // Merge one reviewed flyer ({s: store, d: start, e: end, i: rows, photos}) into
  // the book. photos maps canonical → {blob, fixed}; a scanned photo only fills
  // an item that has none, a photo the admin fixed by hand always replaces.
  // Returns {added, updated, photos, photoErrors}.
  async function mergeFlyer(parsed) {
    // Dedupe rows by canonical — the unique index rejects double-hits otherwise
    const seen = new Set()
    const rows = (parsed.i || [])
      .map(r => ({ canonical: r[0], display: r[1], size: r[2], price: Number(r[3]) }))
      .filter(p => p.canonical && p.price > 0)
      .filter(p => !seen.has(p.canonical) && seen.add(p.canonical))
    if (!rows.length) return { added: 0, updated: 0, photos: 0, photoErrors: 0 }

    const store = normalizeStore(parsed.s, stores.value) || 'Unknown'
    const startDate = parsed.d || today()
    const endDate = parsed.e || null

    const { data: flyer } = await supabase.from('flyers')
      .insert({
        store,
        start_date: startDate,
        end_date: endDate,
        uploaded_by: await currentUserId(),
      })
      .select()
      .single()
      .throwOnError()

    // Match rows to existing items by canonical; create the rest
    const canonicals = rows.map(r => r.canonical)
    const { data: existing } = await supabase.from('items')
      .select('id, canonical, photo_path')
      .in('canonical', canonicals)
      .throwOnError()
    const idByCanonical = new Map(existing.map(e => [e.canonical, e.id]))
    const photoByCanonical = new Map(existing.map(e => [e.canonical, e.photo_path]))

    const newRows = rows.filter(r => !idByCanonical.has(r.canonical))
    if (newRows.length) {
      const { data: created } = await supabase.from('items')
        .upsert(
          newRows.map(r => ({
            canonical: r.canonical,
            display: r.display || r.canonical,
            size: r.size || '',
          })),
          { onConflict: 'canonical' }
        )
        .select('id, canonical')
        .throwOnError()
      created.forEach(e => idByCanonical.set(e.canonical, e.id))
    }

    const createdBy = await currentUserId()
    const { data: inserted } = await supabase.from('price_entries')
      .upsert(
        rows.map(r => ({
          item_id: idByCanonical.get(r.canonical),
          flyer_id: flyer.id,
          store,
          start_date: startDate,
          end_date: endDate,
          price: r.price,
          created_by: createdBy,
        })),
        { onConflict: 'item_id,store,start_date', ignoreDuplicates: true }
      )
      .select('item_id')
      .throwOnError()

    await supabase.from('flyers')
      .update({ item_count: inserted.length })
      .eq('id', flyer.id)
      .throwOnError()

    // Photos are extras: a failed upload never loses the flyer's prices.
    let photos = 0
    let photoErrors = 0
    for (const [canonical, photo] of Object.entries(parsed.photos || {})) {
      const itemId = idByCanonical.get(canonical)
      const old = photoByCanonical.get(canonical)
      if (!itemId || !photo?.blob || (old && !photo.fixed)) continue
      try {
        await savePhoto(itemId, old, photo.blob)
        photos++
      } catch {
        photoErrors++
      }
    }

    await loadAll()
    const added = newRows.length
    return { added, updated: inserted.length - added, photos, photoErrors }
  }

  // Remove one flyer and every price it contributed; the delete_flyer RPC
  // also prunes items left with no history.
  async function deleteFlyer(id) {
    await supabase.rpc('delete_flyer', { fid: id }).throwOnError()
    await loadAll()
  }

  async function updateItem(id, fields) {
    await supabase.from('items').update(fields).eq('id', id).throwOnError()
    await loadAll()
  }

  async function deleteItem(id) {
    const path = items.value.find(i => i.id === id)?.photoPath
    await supabase.from('items').delete().eq('id', id).throwOnError()
    await deletePhoto(path).catch(() => {}) // a leftover file is harmless
    await loadAll()
  }

  // Upload, point the item at it, then drop the old file.
  async function savePhoto(itemId, oldPath, blob) {
    const path = await uploadPhoto(itemId, blob)
    await supabase.from('items').update({ photo_path: path }).eq('id', itemId).throwOnError()
    await deletePhoto(oldPath).catch(() => {})
  }

  async function setItemPhoto(item, blob) {
    await savePhoto(item.id, item.photoPath, blob)
    await loadAll()
  }

  async function removeItemPhoto(item) {
    await supabase.from('items').update({ photo_path: null }).eq('id', item.id).throwOnError()
    await deletePhoto(item.photoPath).catch(() => {})
    await loadAll()
  }

  async function updateEntry(id, fields) {
    await supabase.from('price_entries').update(fields).eq('id', id).throwOnError()
    await loadAll()
  }

  // Deleting an item's last price deletes the item — empty items never show.
  async function deleteEntry(item, entryId) {
    if (item.history.length <= 1) {
      await deleteItem(item.id)
      return
    }
    await supabase.from('price_entries').delete().eq('id', entryId).throwOnError()
    await loadAll()
  }

  // Fold source's history into target and remove source (AI canonical mismatches)
  async function mergeItems(sourceId, targetId) {
    await supabase.rpc('merge_items', { source: sourceId, target: targetId }).throwOnError()
    await loadAll()
  }

  // One price seen in-store, no flyer. Creates the item when itemId is null.
  async function addManualPrice({ itemId, display, size, store, date, endDate, price }) {
    store = normalizeStore(store, stores.value) || 'Unknown'
    let id = itemId
    if (!id) {
      const canonical = `${display} ${size}`.trim().toLowerCase()
      const { data } = await supabase.from('items')
        .upsert({ canonical, display, size: size || '' }, { onConflict: 'canonical' })
        .select('id')
        .single()
        .throwOnError()
      id = data.id
    }
    await supabase.from('price_entries')
      .upsert({
        item_id: id,
        flyer_id: null,
        store,
        start_date: date,
        end_date: endDate || null,
        price,
        created_by: await currentUserId(),
      }, { onConflict: 'item_id,store,start_date', ignoreDuplicates: true })
      .throwOnError()
    await loadAll()
  }

  function exportJSON() {
    return JSON.stringify({ version: 2, items: items.value, flyers: flyers.value }, null, 2)
  }

  // Restore a backup (v2, or v1 which gets migrated). Idempotent: everything
  // upserts, so re-importing the same file adds nothing twice.
  async function importJSON(data) {
    if (!data || !Array.isArray(data.items)) throw new Error('Not a Shelf Check backup file')
    const book = Array.isArray(data.flyers) ? data : migrateV1(data)

    if (book.flyers.length) {
      await supabase.from('flyers')
        .upsert(book.flyers.map(f => ({
          id: f.id,
          store: f.store,
          start_date: f.startDate,
          end_date: f.endDate,
          item_count: f.itemCount,
        })), { onConflict: 'id', ignoreDuplicates: true })
        .throwOnError()
    }

    const { data: upserted } = await supabase.from('items')
      .upsert(book.items.map(it => ({
        canonical: it.canonical,
        display: it.display,
        size: it.size || '',
      })), { onConflict: 'canonical' })
      .select('id, canonical')
      .throwOnError()
    const idByCanonical = new Map(upserted.map(e => [e.canonical, e.id]))

    const entries = book.items.flatMap(it =>
      it.history.map(h => ({
        item_id: idByCanonical.get(it.canonical),
        flyer_id: h.flyerId || null,
        store: h.store,
        start_date: h.date,
        end_date: h.endDate || null,
        price: h.price,
      }))
    )
    for (let i = 0; i < entries.length; i += 500) {
      await supabase.from('price_entries')
        .upsert(entries.slice(i, i + 500),
          { onConflict: 'item_id,store,start_date', ignoreDuplicates: true })
        .throwOnError()
    }

    await loadAll()
  }

  // Old localStorage data from the pre-Supabase builds, if this browser has any.
  function localBackup() {
    for (const key of LOCAL_KEYS) {
      try {
        const raw = localStorage.getItem(key)
        if (raw) return JSON.parse(raw)
      } catch { /* unreadable — skip */ }
    }
    return null
  }

  async function clearAll() {
    await supabase.from('items').delete().not('id', 'is', null).throwOnError()
    await supabase.from('flyers').delete().not('id', 'is', null).throwOnError()
    await loadAll()
  }

  return {
    items, flyers, sortedFlyers, loading, q, filter,
    stores, dealCount, multiCount, saleCount, shown,
    sortedHist, latest, minPrice, isDeal, deltaPct, validity,
    loadAll, mergeFlyer, deleteFlyer, exportJSON, importJSON, localBackup, clearAll,
    updateItem, deleteItem, updateEntry, deleteEntry, mergeItems, addManualPrice,
    setItemPhoto, removeItemPhoto,
  }
}
