<script setup>
import { computed } from 'vue'
import DealMeter from './DealMeter.vue'
import { usePriceBook, shelfCheck } from '../composables/usePriceBook.js'
import { useCart } from '../composables/useCart.js'

const props = defineProps({
  item: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

const emit = defineEmits(['open'])

const { latest, validity } = usePriceBook()
const { inCart, toggle } = useCart()

const carted = computed(() => inCart(props.item.id))

const current = computed(() => latest(props.item))
const check = computed(() => shelfCheck(props.item))
const sale = computed(() => validity(current.value))

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d)) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>

<template>
  <li class="row" :class="{ selected }">
    <button class="row-main" :aria-current="selected ? 'true' : undefined" @click="emit('open', item)">
      <span class="line">
        <span class="name">{{ item.display }}</span>
        <span class="price price-num" :class="`tone-${check.tone}`">${{ current.price.toFixed(2) }}</span>
      </span>
      <span class="line meta">
        <span class="where">
          <template v-if="item.size">{{ item.size }}, </template>{{ current.store }}, {{ fmtDate(current.date) }}
        </span>
        <span v-if="sale" class="tag" :class="`tag-${sale.state}`">{{ sale.label }}</span>
      </span>
      <span v-if="check.count > 1" class="line check">
        <DealMeter :check="check" />
        <span class="verdict" :class="`tone-${check.tone}`">{{ check.verdict }}</span>
      </span>
      <span v-else class="line check first">First price seen. The shelf check starts with the next one.</span>
    </button>

    <button
      class="cart-btn"
      :class="{ carted }"
      :aria-label="carted ? `Remove ${item.display} from shopping list` : `Add ${item.display} to shopping list`"
      :title="carted ? 'On your list' : 'Add to list'"
      @click="toggle(item.id)"
    >
      <svg v-if="carted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
    </button>
  </li>
</template>

<style scoped>
.row {
  list-style: none;
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 12px;
}

.row + .row { border-top: 1px solid var(--hairline); }

.row.selected { background: color-mix(in srgb, var(--low) 7%, var(--surface)); }

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 8px 14px 16px;
  text-align: left;
}

.row-main:hover .name { text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--hairline-strong); }

.line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.name {
  font-weight: 600;
  font-size: 15.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.price {
  flex: none;
  font-size: 21px;
  line-height: 1.1;
}

.price.tone-low { color: var(--low); }

.meta { align-items: center; }

.where {
  font-size: 13px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* sale window, styled like a shelf tag */
.tag {
  flex: none;
  font-size: 11.5px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 4px;
  white-space: nowrap;
  color: var(--muted);
  background: var(--sunken);
}

.tag-ending { background: var(--tag); color: var(--on-tag); }
.tag-expired { text-decoration: line-through; color: var(--faint); }

.check {
  align-items: center;
  margin-top: 6px;
}

.check :deep(.meter) { flex: 1; max-width: 260px; }

.verdict {
  flex: none;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);
}

.verdict.tone-low, .verdict.tone-good { color: var(--low); }
.verdict.tone-high { color: var(--high); }

.first {
  font-size: 12.5px;
  color: var(--faint);
}

.cart-btn {
  flex: none;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1.5px solid var(--hairline-strong);
  color: var(--ink);
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.cart-btn:hover { border-color: var(--ink); }

.cart-btn.carted {
  background: var(--low);
  border-color: var(--low);
  color: var(--surface);
}

@media (max-width: 420px) {
  .check :deep(.meter .end) { display: none; }
}
</style>
