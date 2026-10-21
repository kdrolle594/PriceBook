<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import PhotoFixer from './PhotoFixer.vue'
import { rowBox, cropPhoto } from '../lib/photos.js'
import { normalizeStore } from '../composables/usePriceBook.js'

const props = defineProps({
  parsed: { type: Object, required: true },
  fileName: { type: String, default: '' },
  file: { type: File, default: null }, // the flyer image, for cutting out item photos
  knownCanonicals: { type: Array, default: () => [] },
  stores: { type: Array, default: () => [] },
})

const emit = defineEmits(['save', 'discard'])

const store = ref('')
const startDate = ref('')
const endDate = ref('')
const rows = ref([])
const fixing = ref(null) // row whose photo is being fixed

// Photo per row: {box, blob, url, fixed}; url is an object URL for the preview.
function setPhoto(row, photo) {
  if (row.photo?.url) URL.revokeObjectURL(row.photo.url)
  row.photo = photo && { ...photo, url: URL.createObjectURL(photo.blob) }
}

function dropAllPhotos() {
  for (const r of rows.value) if (r.photo?.url) URL.revokeObjectURL(r.photo.url)
}
onBeforeUnmount(dropAllPhotos)

// Re-seed the form whenever the next flyer in the queue arrives.
watch(() => props.parsed, (p) => {
  dropAllPhotos()
  store.value = normalizeStore(p.s, props.stores)
  startDate.value = p.d || new Date().toISOString().slice(0, 10)
  endDate.value = p.e || ''
  rows.value = (p.i || []).map((r, idx) => ({
    key: idx,
    canonical: r[0],
    display: r[1] || r[0],
    size: r[2] || '',
    price: r[3],
    box: rowBox(r),
    photo: null,
  }))
  cutPhotos(rows.value)
}, { immediate: true })

// Cut each scanned box out of the flyer; a bad box just leaves no photo.
async function cutPhotos(list) {
  if (!props.file) return
  for (const r of list) {
    if (!r.box) continue
    try {
      const blob = await cropPhoto(props.file, r.box)
      if (rows.value.includes(r) && !r.photo) setPhoto(r, { box: r.box, blob, fixed: false })
    } catch { /* leave it without a photo */ }
  }
}

function onFixUse({ blob, box }) {
  const r = fixing.value
  setPhoto(r, { box, blob, fixed: true })
  fixing.value = null
}

function onFixNone() {
  setPhoto(fixing.value, null)
  fixing.value = null
}

const photoCount = computed(() => rows.value.filter(r => r.photo).length)

const known = computed(() => new Set(props.knownCanonicals))

function removeRow(key) {
  const r = rows.value.find(x => x.key === key)
  if (r?.photo?.url) URL.revokeObjectURL(r.photo.url)
  rows.value = rows.value.filter(x => x.key !== key)
}

const saveable = computed(() =>
  rows.value.some(r => r.canonical && !isNaN(Number(r.price)))
)

function save() {
  emit('save', {
    s: store.value.trim() || 'Unknown',
    d: startDate.value || new Date().toISOString().slice(0, 10),
    e: endDate.value || '',
    i: rows.value.map(r => [r.canonical, r.display, r.size, Number(r.price)]),
    photos: Object.fromEntries(rows.value
      .filter(r => r.photo)
      .map(r => [r.canonical, { blob: r.photo.blob, fixed: r.photo.fixed }])),
  })
}

function onKeydown(e) {
  if (e.key === 'Escape' && !fixing.value) emit('discard')
}
</script>

<template>
  <Teleport to="body">
    <div class="scrim" @keydown="onKeydown">
      <div class="card" role="dialog" aria-modal="true" aria-label="Review flyer">
        <header class="card-head">
          <div>
            <h2>Review flyer</h2>
            <p v-if="fileName" class="file mono">{{ fileName }}</p>
          </div>
          <span class="count">
            {{ rows.length }} item{{ rows.length === 1 ? '' : 's' }}<template v-if="file">, {{ photoCount }} with photos</template>
          </span>
        </header>

        <div class="meta">
          <label class="field">
            <span class="label">Store</span>
            <input v-model="store" type="text" placeholder="Store name" list="review-stores">
            <datalist id="review-stores">
              <option v-for="st in stores" :key="st" :value="st" />
            </datalist>
          </label>
          <label class="field">
            <span class="label">Sale starts</span>
            <input v-model="startDate" type="date">
          </label>
          <label class="field">
            <span class="label">Sale ends</span>
            <input v-model="endDate" type="date" :min="startDate">
          </label>
        </div>

        <div class="rows">
          <p v-if="file" class="photo-hint">Tap a photo to fix it, or + to add one. Scanned photos only fill items without one; photos you fix replace the old one.</p>
          <div v-for="r in rows" :key="r.key" class="item-row">
            <button
              v-if="file"
              class="thumb"
              :class="{ empty: !r.photo, fixed: r.photo?.fixed }"
              :aria-label="r.photo ? `Fix photo for ${r.display}` : `Add photo for ${r.display}`"
              @click="fixing = r"
            >
              <img v-if="r.photo" :src="r.photo.url" alt="">
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <div class="item-fields">
              <input v-model="r.display" class="f-name" type="text" aria-label="Item name">
              <input v-model="r.size" class="f-size" type="text" placeholder="size" aria-label="Size">
              <input v-model="r.price" class="f-price mono" type="number" step="0.01" min="0" aria-label="Price">
            </div>
            <span v-if="known.has(r.canonical)" class="chip chip-match" title="Will add to this item's price history">tracked</span>
            <span v-else class="chip chip-new">new</span>
            <button class="remove" :aria-label="`Remove ${r.display}`" @click="removeRow(r.key)">✕</button>
          </div>
          <p v-if="!rows.length" class="empty">All rows removed — discard this flyer or add it back by re-scanning.</p>
        </div>

        <footer class="card-foot">
          <button class="ghost" @click="emit('discard')">Discard flyer</button>
          <button class="primary" :disabled="!saveable" @click="save">
            Save {{ rows.length }} item{{ rows.length === 1 ? '' : 's' }}
          </button>
        </footer>
      </div>
    </div>

    <PhotoFixer
      v-if="fixing"
      :file="file"
      :box="fixing.photo?.box || fixing.box"
      :name="fixing.display"
      @use="onFixUse"
      @none="onFixNone"
      @cancel="fixing = null"
    />
  </Teleport>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: fade 0.18s ease;
}

@keyframes fade { from { opacity: 0; } }

.card {
  width: min(560px, 100%);
  max-height: min(720px, 100%);
  display: flex;
  flex-direction: column;
  background: var(--bg);
  border: 1px solid var(--hairline);
  border-radius: var(--radius);
  padding: 20px 22px;
  animation: rise 0.22s ease;
}

@keyframes rise { from { transform: translateY(10px); opacity: 0; } }

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

h2 {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
}

.file {
  font-size: 12px;
  color: var(--faint);
  margin-top: 2px;
}

.count {
  font-size: 12.5px;
  color: var(--muted);
  white-space: nowrap;
  padding-top: 4px;
}

.meta {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.field:first-child { flex: 1.4; }

.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}

input {
  width: 100%;
  padding: 8px 10px;
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
  font-size: 13.5px;
}

input:focus {
  outline: none;
  border-color: var(--hairline-strong);
  box-shadow: 0 0 0 3px var(--low-soft);
}

.rows {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border-top: 1px solid var(--hairline);
  padding: 6px 0;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.photo-hint {
  font-size: 12.5px;
  color: var(--muted);
  padding: 2px 0 6px;
}

.thumb {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--hairline);
  display: grid;
  place-items: center;
}

.thumb img { width: 100%; height: 100%; object-fit: contain; }
.thumb.empty { border-style: dashed; color: var(--faint); }
.thumb.fixed { border-color: var(--low); box-shadow: 0 0 0 1px var(--low); }
.thumb:hover { border-color: var(--ink); }

.thumb svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.item-fields {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 6px;
}

.f-name { flex: 1; min-width: 0; }
.f-size { width: 76px; flex: none; }
.f-price { width: 84px; flex: none; text-align: right; }

.chip {
  flex: none;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 99px;
  white-space: nowrap;
}

.chip-match { background: var(--low-soft); color: var(--low); }
.chip-new { background: var(--surface); color: var(--faint); border: 1px solid var(--hairline); }

.remove {
  flex: none;
  color: var(--faint);
  font-size: 12px;
  padding: 5px 7px;
  border-radius: var(--radius-sm);
}

.remove:hover { color: var(--danger); background: var(--danger-soft); }

.empty {
  font-size: 13px;
  color: var(--muted);
  text-align: center;
  padding: 20px 0;
}

.card-foot {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--hairline);
}

.primary {
  padding: 8px 18px;
  background: var(--ink);
  color: var(--bg);
  font-weight: 600;
  font-size: 13.5px;
  border-radius: var(--radius-sm);
  transition: opacity 0.15s ease;
}

.primary:hover:not(:disabled) { opacity: 0.85; }
.primary:disabled { opacity: 0.4; cursor: not-allowed; }

.ghost {
  padding: 8px 12px;
  color: var(--muted);
  font-size: 13px;
  border-radius: var(--radius-sm);
}

.ghost:hover { color: var(--danger); background: var(--danger-soft); }

@media (max-width: 480px) {
  .meta { flex-wrap: wrap; }
  .field:first-child { flex-basis: 100%; }
}
</style>
