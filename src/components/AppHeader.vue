<script setup>
defineProps({
  itemCount: { type: Number, required: true },
  flyerCount: { type: Number, required: true },
  cartCount: { type: Number, default: 0 },
})

const emit = defineEmits(['open-settings', 'open-cart'])
</script>

<template>
  <header class="head">
    <div class="head-inner">
      <div class="brand">
        <h1>Price Book</h1>
        <p class="tagline mono">
          {{ itemCount }} items · {{ flyerCount }} {{ flyerCount === 1 ? 'flyer' : 'flyers' }} scanned
        </p>
      </div>
      <button class="cart" aria-label="Open shopping list" title="Shopping list" @click="emit('open-cart')">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        <span v-if="cartCount" class="badge mono">{{ cartCount > 99 ? '99+' : cartCount }}</span>
      </button>
      <button class="gear" aria-label="Open settings" title="Settings" @click="emit('open-settings')">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.head {
  position: sticky;
  top: 0;
  z-index: 10;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--hairline);
}

.head-inner {
  max-width: var(--col);
  margin: 0 auto;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

h1 {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.tagline {
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.02em;
}

.cart {
  position: relative;
  color: var(--muted);
  padding: 8px;
  border-radius: var(--radius-sm);
  display: flex;
  transition: color 0.15s ease;
}

.cart:hover {
  color: var(--ink);
  background: var(--surface);
}

.badge {
  position: absolute;
  top: 0;
  right: -2px;
  min-width: 16px;
  padding: 1px 4px;
  background: var(--ink);
  color: var(--bg);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  border-radius: 99px;
}

.gear {
  color: var(--muted);
  padding: 8px;
  border-radius: var(--radius-sm);
  display: flex;
  transition: color 0.15s ease, transform 0.3s ease;
}

.gear:hover {
  color: var(--ink);
  background: var(--surface);
  transform: rotate(30deg);
}
</style>
