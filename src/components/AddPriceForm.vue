<script setup>
import { ref, computed } from 'vue'
import { usePriceBook } from '../composables/usePriceBook.js'

const props = defineProps({
  // With an item: adds a sighting to it. Without: creates the item too.
  item: { type: Object, default: null },
  stores: { type: Array, default: () => [] },
})

const emit = defineEmits(['done', 'error'])

const { addManualPrice } = usePriceBook()

const display = ref('')
const size = ref('')
const store = ref('')
const date = ref(new Date().toISOString().slice(0, 10))
const endDate = ref('')
const price = ref('')
const busy = ref(false)

const valid = computed(() =>
  (props.item || display.value.trim())
  && store.value.trim()
  && date.value
  && Number(price.value) > 0
)

async function submit() {
  if (!valid.value || busy.value) return
  busy.value = true
  try {
    await addManualPrice({
      itemId: props.item?.id || null,
      display: display.value.trim(),
      size: size.value.trim(),
      store: store.value.trim(),
      date: date.value,
      endDate: endDate.value || null,
      price: Number(price.value),
    })
    emit('done', `${props.item?.display || display.value.trim()}: price added`)
    display.value = ''
    size.value = ''
    price.value = ''
    endDate.value = ''
  } catch (err) {
    emit('error', err.message)
  }
  busy.value = false
}
</script>

<template>
  <form class="add" @submit.prevent="submit">
    <template v-if="!item">
      <input v-model="display" class="f-name" type="text" placeholder="Item (e.g. Oat Milk 1L)" aria-label="Item name">
      <input v-model="size" class="f-size" type="text" placeholder="size" aria-label="Size">
    </template>
    <input v-model="store" class="f-store" type="text" placeholder="Store" list="store-options" aria-label="Store">
    <datalist id="store-options">
      <option v-for="s in stores" :key="s" :value="s" />
    </datalist>
    <input v-model="date" class="f-date" type="date" aria-label="Date seen">
    <input v-model="endDate" class="f-date" type="date" :min="date" aria-label="Sale ends (optional)" title="Sale ends (optional)">
    <input v-model="price" class="f-price mono" type="number" step="0.01" min="0.01" placeholder="$" aria-label="Price">
    <button class="go" type="submit" :disabled="!valid || busy">{{ busy ? '…' : 'Add' }}</button>
  </form>
</template>

<style scoped>
.add {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

input {
  padding: 8px 10px;
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
  font-size: 13px;
  min-width: 0;
}

input:focus {
  outline: none;
  border-color: var(--hairline-strong);
  box-shadow: 0 0 0 3px var(--low-soft);
}

.f-name { flex: 2 1 140px; }
.f-size { flex: 0 1 70px; }
.f-store { flex: 1.5 1 110px; }
.f-date { flex: 0 1 128px; }
.f-price { flex: 0 1 78px; text-align: right; }

.go {
  padding: 8px 16px;
  background: var(--ink);
  color: var(--bg);
  font-weight: 600;
  font-size: 13px;
  border-radius: var(--radius-sm);
}

.go:hover:not(:disabled) { opacity: 0.85; }
.go:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
