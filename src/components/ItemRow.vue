<script setup>
import { computed } from 'vue'
import Sparkline from './Sparkline.vue'
import { usePriceBook } from '../composables/usePriceBook.js'
import { useCart } from '../composables/useCart.js'

const props = defineProps({
  item: { type: Object, required: true },
})

const emit = defineEmits(['open'])

const { sortedHist, latest, minPrice, isDeal, deltaPct, validity } = usePriceBook()
const { inCart, toggle } = useCart()

const carted = computed(() => inCart(props.item.id))

const hist = computed(() => sortedHist(props.item))
const current = computed(() => latest(props.item))
const min = computed(() => minPrice(props.item))
const deal = computed(() => isDeal(props.item))
const delta = computed(() => deltaPct(props.item))
const hasHistory = computed(() => props.item.history.length > 1)
const sale = computed(() => validity(current.value))

// chronological prices for the sparkline (oldest → newest)
const trend = computed(() => [...hist.value].reverse().map(h => h.price))

const deltaLabel = computed(() => {
  if (delta.value === null) return ''
  const pct = Math.abs(delta.value).toFixed(0)
  if (Math.round(delta.value) === 0) return 'same as last'
  return delta.value < 0 ? `↓ ${pct}% vs last` : `↑ ${pct}% vs last`
})

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d)) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>

<template>
  <li class="row">
    <button class="row-main" @click="emit('open', item)">
      <div class="row-id">
        <span class="row-name">{{ item.display }}</span>
        <span class="row-meta">
          <span v-if="item.size">{{ item.size }}</span>
          <span v-if="item.size"> · </span>
          <span>{{ current.store }} · {{ fmtDate(current.date) }}</span>
        </span>
      </div>

      <Sparkline v-if="hasHistory" :prices="trend" />

      <div class="row-price">
        <span class="price mono" :class="{ 'is-low': hasHistory && deal }">
          ${{ current.price.toFixed(2) }}
        </span>
        <span v-if="hasHistory && deal" class="chip chip-low">historic low</span>
        <span v-else-if="hasHistory" class="chip chip-high">{{ deltaLabel || 'seen cheaper' }}</span>
        <span v-else class="chip chip-plain">first sighting</span>
        <span v-if="sale" class="chip" :class="`chip-${sale.state}`">{{ sale.label }}</span>
      </div>

      <span class="caret" aria-hidden="true">›</span>
    </button>

    <button
      class="cart-btn"
      :class="{ carted }"
      :aria-label="carted ? `Remove ${item.display} from shopping list` : `Add ${item.display} to shopping list`"
      :title="carted ? 'In your shopping list' : 'Add to shopping list'"
      @click="toggle(item.id)"
    >
      {{ carted ? '✓' : '+' }}
    </button>
  </li>
</template>

<style scoped>
.row {
  list-style: none;
  display: flex;
  align-items: center;
  gap: 4px;
  border-bottom: 1px solid var(--hairline);
}

.row-main {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
  padding: 14px 4px;
  text-align: left;
  border-radius: var(--radius-sm);
}

.cart-btn {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--hairline);
  background: var(--surface);
  color: var(--muted);
  font-size: 15px;
  line-height: 1;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.cart-btn:hover { color: var(--ink); border-color: var(--hairline-strong); }

.cart-btn.carted {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--bg);
}

.row-main:hover { background: var(--surface); }

.row-id {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.row-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-meta {
  font-size: 12.5px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex: none;
}

.price {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.price.is-low { color: var(--low); }

.chip {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 1px 7px;
  border-radius: 99px;
  white-space: nowrap;
}

.chip-low { background: var(--low-soft); color: var(--low); }
.chip-high { background: var(--high-soft); color: var(--high); }
.chip-plain { background: var(--surface); color: var(--faint); border: 1px solid var(--hairline); }
.chip-active { background: var(--surface); color: var(--muted); border: 1px solid var(--hairline); }
.chip-ending { background: var(--high-soft); color: var(--high); }
.chip-expired { background: var(--surface); color: var(--faint); border: 1px solid var(--hairline); text-decoration: line-through; }

.caret {
  flex: none;
  color: var(--faint);
  font-size: 15px;
}

@media (max-width: 480px) {
  .row-main { gap: 10px; }
  .spark, .row-main :deep(.spark) { display: none; }
}
</style>
