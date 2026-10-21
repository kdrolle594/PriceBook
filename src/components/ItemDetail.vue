<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import PriceChart from './PriceChart.vue'
import AddPriceForm from './AddPriceForm.vue'
import DealMeter from './DealMeter.vue'
import PhotoFixer from './PhotoFixer.vue'
import { photoUrl } from '../lib/photos.js'
import { usePriceBook, shelfCheck } from '../composables/usePriceBook.js'

const props = defineProps({
  item: { type: Object, required: true },
  isAdmin: { type: Boolean, default: false },
  docked: { type: Boolean, default: false }, // desktop side panel instead of a sheet
})

const emit = defineEmits(['close'])

const {
  items, stores, sortedHist, minPrice, validity,
  updateItem, deleteItem, updateEntry, deleteEntry, mergeItems,
  setItemPhoto, removeItemPhoto,
} = usePriceBook()

const photo = computed(() => photoUrl(props.item.photoPath))
const fixingPhoto = ref(false)

function onPhotoUse({ blob }) {
  fixingPhoto.value = false
  run(() => setItemPhoto(props.item, blob), 'Photo saved')
}

function onPhotoNone() {
  fixingPhoto.value = false
  if (props.item.photoPath) run(() => removeItemPhoto(props.item), 'Photo removed')
}

const err = ref('')
const notice = ref('')

const hist = computed(() => sortedHist(props.item))
const min = computed(() => minPrice(props.item))
const check = computed(() => shelfCheck(props.item))
const firstSeen = computed(() => hist.value[hist.value.length - 1].date)

const closeBtn = ref(null)
onMounted(() => { if (!props.docked) closeBtn.value?.focus() })

// edit form state
const draftName = ref(props.item.display)
const draftSize = ref(props.item.size)
watch(() => props.item, (it) => {
  draftName.value = it.display
  draftSize.value = it.size
})

const nameDirty = computed(() =>
  draftName.value.trim() !== props.item.display || draftSize.value.trim() !== props.item.size
)

const mergeTarget = ref('')
const confirmMerge = ref(false)
const confirmDelete = ref(false)
const otherItems = computed(() =>
  items.value
    .filter(i => i.id !== props.item.id)
    .sort((a, b) => a.display.localeCompare(b.display))
)

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d)) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

async function run(action, okMsg) {
  err.value = ''
  notice.value = ''
  try {
    await action()
    if (okMsg) notice.value = okMsg
  } catch (e) {
    err.value = e.message
  }
}

const saveName = () => run(
  () => updateItem(props.item.id, { display: draftName.value.trim(), size: draftSize.value.trim() }),
  'Saved'
)

function onPriceChange(h, e) {
  const v = Number(e.target.value)
  if (!(v > 0) || v === h.price) { e.target.value = h.price.toFixed(2); return }
  run(() => updateEntry(h.id, { price: v }), 'Price updated')
}

const removeEntry = (h) => run(async () => {
  const wasLast = props.item.history.length <= 1
  await deleteEntry(props.item, h.id)
  if (wasLast) emit('close')
}, 'Entry removed')

async function merge() {
  if (!mergeTarget.value) return
  if (!confirmMerge.value) { confirmMerge.value = true; return }
  await run(async () => {
    await mergeItems(props.item.id, mergeTarget.value)
    emit('close')
  })
  confirmMerge.value = false
}

async function removeItem() {
  if (!confirmDelete.value) { confirmDelete.value = true; return }
  await run(async () => {
    await deleteItem(props.item.id)
    emit('close')
  })
}

function onKeydown(e) {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <Teleport to="body" :disabled="docked">
    <div class="scrim" :class="{ docked }" @click.self="emit('close')" @keydown="onKeydown">
      <div
        class="card"
        :role="docked ? 'region' : 'dialog'"
        :aria-modal="docked ? undefined : 'true'"
        :aria-label="item.display"
      >
        <header class="card-head">
          <img v-if="photo" class="photo" :src="photo" alt="">
          <div class="title">
            <h2>{{ item.display }}</h2>
            <p v-if="item.size" class="sub">{{ item.size }}</p>
          </div>
          <button ref="closeBtn" class="close" aria-label="Close" @click="emit('close')">✕</button>
        </header>

        <div class="body">
          <section class="check" :class="`tone-${check.tone}`">
            <div class="check-top">
              <span class="check-price price-num">${{ check.current.toFixed(2) }}</span>
              <span class="check-verdict">{{ check.verdict }}</span>
            </div>
            <template v-if="check.count > 1">
              <DealMeter :check="check" large />
              <p class="check-note">
                Shelf check across {{ check.count }} prices seen since {{ fmtDate(firstSeen) }}.
              </p>
            </template>
            <p v-else class="check-note">Only one price so far. The shelf check fills in after the next flyer.</p>
          </section>

          <PriceChart v-if="item.history.length > 1" :history="item.history" />

          <div class="hist">
            <div v-for="h in hist" :key="h.id" class="hist-line">
              <span class="hist-when">
                {{ fmtDate(h.date) }}<template v-if="h.endDate"> – {{ fmtDate(h.endDate) }}</template>
              </span>
              <span class="hist-store">
                {{ h.store }}
                <span v-if="validity(h)?.state === 'active' || validity(h)?.state === 'ending'" class="live">
                  {{ validity(h).label }}
                </span>
              </span>
              <input
                v-if="isAdmin"
                class="hist-price-edit mono"
                type="number" step="0.01" min="0.01"
                :value="h.price.toFixed(2)"
                :class="{ 'is-min': h.price === min }"
                @change="onPriceChange(h, $event)"
              >
              <span v-else class="hist-price mono" :class="{ 'is-min': h.price === min }">
                ${{ h.price.toFixed(2) }}
              </span>
              <button
                v-if="isAdmin"
                class="entry-remove"
                :aria-label="`Remove ${fmtDate(h.date)} ${h.store} price`"
                @click="removeEntry(h)"
              >✕</button>
            </div>
          </div>

          <p v-if="err" class="msg err" role="alert">{{ err }}</p>
          <p v-else-if="notice" class="msg" role="status">{{ notice }}</p>

          <template v-if="isAdmin">
            <section class="tool">
              <h3 class="label">Add a price</h3>
              <AddPriceForm
                :item="item"
                :stores="stores"
                @done="notice = 'Price added'; err = ''"
                @error="err = $event"
              />
            </section>

            <section class="tool">
              <h3 class="label">Photo</h3>
              <p class="hint">
                {{ photo ? 'Wrong picture? Swap it for another or remove it.' : 'No photo yet. Add one from your phone or computer.' }}
              </p>
              <button class="ghost solid" @click="fixingPhoto = true">{{ photo ? 'Change photo' : 'Add photo' }}</button>
            </section>

            <section class="tool">
              <h3 class="label">Edit item</h3>
              <div class="edit-row">
                <input v-model="draftName" class="f-name" type="text" aria-label="Item name">
                <input v-model="draftSize" class="f-size" type="text" placeholder="size" aria-label="Size">
                <button class="ghost solid" :disabled="!nameDirty || !draftName.trim()" @click="saveName">Save</button>
              </div>
            </section>

            <section class="tool">
              <h3 class="label">Merge a duplicate</h3>
              <p class="hint">Moves every price into the item below, then removes this one.</p>
              <div class="edit-row">
                <select v-model="mergeTarget" aria-label="Merge into item" @change="confirmMerge = false">
                  <option value="" disabled>Merge into…</option>
                  <option v-for="o in otherItems" :key="o.id" :value="o.id">
                    {{ o.display }}{{ o.size ? ` (${o.size})` : '' }}
                  </option>
                </select>
                <button class="ghost solid" :disabled="!mergeTarget" @click="merge">
                  {{ confirmMerge ? 'Really merge?' : 'Merge' }}
                </button>
              </div>
            </section>

            <section class="tool">
              <button class="danger" @click="removeItem">
                {{ confirmDelete ? 'Really delete this item and its prices?' : 'Delete item' }}
              </button>
              <button v-if="confirmDelete" class="ghost" @click="confirmDelete = false">Keep it</button>
            </section>
          </template>
        </div>
      </div>
    </div>
  </Teleport>

  <PhotoFixer
    v-if="fixingPhoto"
    :name="item.display"
    @use="onPhotoUse"
    @none="onPhotoNone"
    @cancel="fixingPhoto = false"
  />
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  z-index: 55;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-top: 32px;
  animation: fade 0.18s ease;
}

@keyframes fade { from { opacity: 0; } }

/* phones: a sheet that slides up from the tab bar */
.card {
  width: min(620px, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: 22px 22px 0 0;
  padding: 10px 20px calc(20px + env(safe-area-inset-bottom));
  box-shadow: var(--shadow);
  animation: rise 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.card::before {
  content: "";
  align-self: center;
  width: 40px;
  height: 4px;
  border-radius: 99px;
  background: var(--hairline-strong);
  margin-bottom: 12px;
}

@keyframes rise { from { transform: translateY(40px); opacity: 0; } }

/* desktop: docked beside the list */
.scrim.docked {
  position: static;
  background: none;
  padding: 0;
  display: block;
  animation: none;
}

.docked .card {
  width: 100%;
  max-height: calc(100dvh - 116px);
  border-radius: var(--radius);
  padding: 20px 22px;
  box-shadow: 0 0 0 1px var(--hairline);
  animation: none;
}

.docked .card::before { display: none; }

.check {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 14px;
  background: var(--bg);
}

.check-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.check-price {
  font-size: 34px;
  line-height: 1;
}

.check-verdict {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 700;
  color: var(--muted);
}

.tone-low .check-price, .tone-low .check-verdict, .tone-good .check-verdict { color: var(--low); }
.tone-high .check-verdict { color: var(--high); }

.check-note {
  font-size: 13px;
  color: var(--muted);
}

.card-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 14px;
}

.photo {
  flex: none;
  width: 84px;
  height: 84px;
  object-fit: contain;
  background: #fff;
  border-radius: 14px;
  box-shadow: inset 0 0 0 1px var(--hairline);
}

.title { flex: 1; min-width: 0; }

h2 {
  font-family: var(--font-display);
  font-size: 23px;
  font-weight: 800;
  letter-spacing: -0.015em;
  line-height: 1.15;
}

.sub {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}

.close {
  color: var(--muted);
  font-size: 14px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
}

.close:hover { color: var(--ink); background: var(--sunken); }

.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hist {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-top: 1px solid var(--hairline);
  padding-top: 8px;
}

.hist-line {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  padding: 3px 0;
}

.hist-when {
  color: var(--muted);
  font-size: 12px;
  min-width: 64px;
  flex: none;
  font-variant-numeric: tabular-nums;
}

.hist-store {
  flex: 1;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.live {
  color: var(--low);
  font-size: 11px;
  font-weight: 600;
  margin-left: 6px;
}

.hist-price { color: var(--ink); }

.hist-price-edit {
  width: 82px;
  text-align: right;
  padding: 4px 8px;
  background: var(--bg);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.hist-price.is-min, .hist-price-edit.is-min {
  color: var(--low);
  font-weight: 600;
}

.entry-remove {
  color: var(--faint);
  font-size: 11px;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
}

.entry-remove:hover { color: var(--danger); background: var(--danger-soft); }

.msg {
  font-size: 12.5px;
  color: var(--muted);
  text-align: center;
}

.msg.err { color: var(--danger); }

.tool {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--hairline);
  padding-top: 14px;
}

.label {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
}

.hint {
  font-size: 12.5px;
  color: var(--faint);
}

.edit-row {
  display: flex;
  gap: 6px;
}

.edit-row input, .edit-row select {
  padding: 8px 10px;
  background: var(--bg);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
  font-size: 13px;
  min-width: 0;
}

.edit-row input:focus, .edit-row select:focus {
  outline: none;
  border-color: var(--hairline-strong);
  box-shadow: 0 0 0 3px var(--low-soft);
}

.f-name { flex: 1; }
.f-size { width: 80px; flex: none; }

select { flex: 1; }

.ghost {
  align-self: flex-start;
  padding: 8px 12px;
  color: var(--muted);
  font-size: 13px;
  border-radius: var(--radius-sm);
}

.ghost:hover { color: var(--ink); background: var(--bg); }

.ghost.solid {
  color: var(--ink);
  background: var(--bg);
  border: 1px solid var(--hairline);
  font-weight: 600;
  flex: none;
}

.ghost.solid:hover:not(:disabled) { border-color: var(--hairline-strong); }
.ghost.solid:disabled { opacity: 0.4; cursor: not-allowed; }

.danger {
  align-self: flex-start;
  padding: 8px 14px;
  background: var(--danger-soft);
  color: var(--danger);
  font-weight: 600;
  font-size: 13px;
  border-radius: var(--radius-sm);
}
</style>
