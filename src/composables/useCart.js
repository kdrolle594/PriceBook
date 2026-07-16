import { ref, computed, watch } from 'vue'

// Shopping list lives in this browser only — viewing needs no account, so
// there's no user to attach it to server-side.
const CART_KEY = 'pricebook-cart-v1'

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    if (Array.isArray(parsed)) {
      return parsed.filter(l => l && typeof l.itemId === 'string' && Number.isInteger(l.qty) && l.qty > 0)
    }
  } catch { /* unreadable or no localStorage — start empty */ }
  return []
}

// lines: [{itemId, qty}]
const lines = ref(load())

watch(lines, (val) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(val))
  } catch { /* storage full or unavailable — cart just won't persist */ }
}, { deep: true })

export function useCart() {
  const count = computed(() => lines.value.reduce((n, l) => n + l.qty, 0))

  function find(itemId) {
    return lines.value.find(l => l.itemId === itemId)
  }
  function inCart(itemId) {
    return Boolean(find(itemId))
  }
  function qtyOf(itemId) {
    return find(itemId)?.qty || 0
  }
  function add(itemId) {
    const line = find(itemId)
    if (line) line.qty++
    else lines.value.push({ itemId, qty: 1 })
  }
  function setQty(itemId, qty) {
    if (qty <= 0) {
      remove(itemId)
      return
    }
    const line = find(itemId)
    if (line) line.qty = qty
    else lines.value.push({ itemId, qty })
  }
  function toggle(itemId) {
    if (inCart(itemId)) remove(itemId)
    else add(itemId)
  }
  function remove(itemId) {
    lines.value = lines.value.filter(l => l.itemId !== itemId)
  }
  function clear() {
    lines.value = []
  }

  return { lines, count, inCart, qtyOf, add, setQty, toggle, remove, clear }
}
