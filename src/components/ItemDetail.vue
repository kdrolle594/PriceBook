<script setup>
import { ref, computed, watch } from 'vue'
import PriceChart from './PriceChart.vue'
import AddPriceForm from './AddPriceForm.vue'
import { usePriceBook } from '../composables/usePriceBook.js'

const props = defineProps({
  item: { type: Object, required: true },
  isAdmin: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const {
  items, stores, sortedHist, minPrice, validity,
  updateItem, deleteItem, updateEntry, deleteEntry, mergeItems,
} = usePriceBook()

const err = ref('')
const notice = ref('')

const hist = computed(() => sortedHist(props.item))
const min = computed(() => minPrice(props.item))

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
  <Teleport to="body">
    <div class="scrim" @click.self="emit('close')" @keydown="onKeydown">
      <div class="card" role="dialog" aria-modal="true" :aria-label="item.display">
        <header class="card-head">
          <div>
            <h2>{{ item.display }}</h2>
            <p v-if="item.size" class="sub mono">{{ item.size }}</p>
          </div>
          <button class="close" aria-label="Close" @click="emit('close')">✕</button>
        </header>

        <div class="body">
          <PriceChart v-if="item.history.length > 1" :history="item.history" />

          <div class="hist">
            <div v-for="h in hist" :key="h.id" class="hist-line">
              <span class="hist-when mono">
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
              <span class="label">Add a price</span>
              <AddPriceForm
                :item="item"
                :stores="stores"
                @done="notice = 'Price added'; err = ''"
                @error="err = $event"
              />
            </section>

            <section class="tool">
              <span class="label">Edit item</span>
              <div class="edit-row">
                <input v-model="draftName" class="f-name" type="text" aria-label="Item name">
                <input v-model="draftSize" class="f-size" type="text" placeholder="size" aria-label="Size">
                <button class="ghost solid" :disabled="!nameDirty || !draftName.trim()" @click="saveName">Save</button>
              </div>
            </section>

            <section class="tool">
              <span class="label">Merge duplicate</span>
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
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  z-index: 55;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: fade 0.18s ease;
}

@keyframes fade { from { opacity: 0; } }

.card {
  width: min(620px, 100%);
  max-height: min(760px, 100%);
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

.close:hover { color: var(--ink); background: var(--surface); }

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
  background: var(--surface);
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
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
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
  background: var(--surface);
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

.ghost:hover { color: var(--ink); background: var(--surface); }

.ghost.solid {
  color: var(--ink);
  background: var(--surface);
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
