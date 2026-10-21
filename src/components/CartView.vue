<script setup>
import { computed } from 'vue'
import { usePriceBook, bestOffer, validity } from '../composables/usePriceBook.js'
import { useCart } from '../composables/useCart.js'

const { items } = usePriceBook()
const { lines, count, setQty, remove, clear } = useCart()

// Resolve cart lines against the book, pricing each at its best current
// offer; lines whose item was deleted are skipped.
const resolved = computed(() =>
  lines.value.flatMap(l => {
    const item = items.value.find(i => i.id === l.itemId)
    if (!item) return []
    const { entry, onSale } = bestOffer(item)
    return [{ item, qty: l.qty, entry, onSale, lineTotal: entry.price * l.qty }]
  })
)

// Cheapest offers can point at different stores — break the cost down per
// store so the list doubles as a per-store shopping plan.
const byStore = computed(() => {
  const groups = new Map()
  for (const line of resolved.value) {
    const g = groups.get(line.entry.store) || { store: line.entry.store, lines: [], subtotal: 0 }
    g.lines.push(line)
    g.subtotal += line.lineTotal
    groups.set(line.entry.store, g)
  }
  return [...groups.values()].sort((a, b) => a.store.localeCompare(b.store))
})

const total = computed(() => resolved.value.reduce((n, l) => n + l.lineTotal, 0))

function saleNote(line) {
  if (line.onSale) {
    const v = validity(line.entry)
    return v ? `on sale, ${v.label}` : 'on sale'
  }
  const d = new Date(line.entry.date + 'T00:00:00')
  const seen = isNaN(d) ? line.entry.date : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `last seen ${seen}`
}
</script>

<template>
  <section class="cart">
    <div class="cart-head">
      <h2>Shopping list</h2>
      <button v-if="resolved.length" class="clear" @click="clear">Clear list</button>
    </div>
    <p v-if="resolved.length" class="sub">
      {{ count }} item{{ count === 1 ? '' : 's' }}, each priced at its best current offer
    </p>

    <div v-if="resolved.length" class="groups">
      <div v-for="g in byStore" :key="g.store" class="group">
        <header class="group-head">
          <h3>{{ g.store }}</h3>
          <span class="price-num subtotal">${{ g.subtotal.toFixed(2) }}</span>
        </header>

        <ul>
          <li v-for="line in g.lines" :key="line.item.id" class="line">
            <div class="line-id">
              <span class="line-name">{{ line.item.display }}</span>
              <span class="line-meta">
                <span v-if="line.item.size">{{ line.item.size }}, </span>
                <span class="mono">${{ line.entry.price.toFixed(2) }}</span> each,
                <span :class="{ sale: line.onSale }">{{ saleNote(line) }}</span>
              </span>
            </div>

            <div class="qty" role="group" :aria-label="`Quantity of ${line.item.display}`">
              <button class="step" :aria-label="`One less ${line.item.display}`" @click="setQty(line.item.id, line.qty - 1)">−</button>
              <span class="mono qty-n">{{ line.qty }}</span>
              <button class="step" :aria-label="`One more ${line.item.display}`" @click="setQty(line.item.id, line.qty + 1)">+</button>
            </div>

            <span class="price-num line-total">${{ line.lineTotal.toFixed(2) }}</span>

            <button class="remove" :aria-label="`Remove ${line.item.display} from list`" @click="remove(line.item.id)">✕</button>
          </li>
        </ul>
      </div>

      <footer class="total-row">
        <span>Estimated total</span>
        <span class="price-num total">${{ total.toFixed(2) }}</span>
      </footer>
    </div>

    <p v-else class="empty">
      Your list is empty. Tap + on any item to add it.
    </p>
  </section>
</template>

<style scoped>
.cart {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cart-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.clear {
  font-size: 12.5px;
  color: var(--muted);
  padding: 6px 8px;
  border-radius: var(--radius-sm);
}

.clear:hover { color: var(--danger); background: var(--danger-soft); }

h2 {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.sub {
  font-size: 13px;
  color: var(--muted);
}

.groups {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 12px;
}

.group {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: 0 0 0 1px var(--hairline);
  padding: 4px 16px;
}

.group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 0 8px;
  border-bottom: 1px solid var(--hairline);
}

h3 {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 700;
}

.subtotal {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--muted);
}

ul { list-style: none; }

.line {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
}

.line + .line { border-top: 1px solid var(--hairline); }

.line-id {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.line-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-meta {
  font-size: 12.5px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-meta .sale { color: var(--low); }

.qty {
  flex: none;
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg);
  border: 1px solid var(--hairline);
  border-radius: 99px;
  padding: 3px;
}

.step {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: var(--muted);
  font-size: 14px;
  line-height: 1;
}

.step:hover { color: var(--ink); background: var(--sunken); }

.qty-n {
  min-width: 20px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
}

.line-total {
  flex: none;
  min-width: 62px;
  text-align: right;
  font-size: 14.5px;
  font-weight: 600;
}

.remove {
  flex: none;
  color: var(--faint);
  font-size: 12px;
  padding: 5px 7px;
  border-radius: var(--radius-sm);
}

.remove:hover { color: var(--danger); background: var(--danger-soft); }

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 4px 4px 0;
  font-weight: 600;
}

.total {
  font-family: var(--font-display);
  font-size: 30px;
}

.empty {
  text-align: center;
  color: var(--muted);
  font-size: 14px;
  padding: 40px 0;
}

@media (max-width: 480px) {
  .line { flex-wrap: wrap; }
  .line-id { flex-basis: 100%; }
  .qty { margin-left: auto; }
}
</style>
