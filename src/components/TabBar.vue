<script setup>
defineProps({
  active: { type: String, required: true }, // 'prices' | 'deals' | 'list'
  cartCount: { type: Number, default: 0 },
  dealCount: { type: Number, default: 0 },
  isAdmin: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  inline: { type: Boolean, default: false }, // desktop: sits in the header
})

const emit = defineEmits(['select', 'scan', 'more'])
</script>

<template>
  <nav class="tabs" :class="{ inline }" aria-label="Main">
    <button class="tab" :aria-current="active === 'prices' ? 'page' : undefined" @click="emit('select', 'prices')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
      <span>Prices</span>
    </button>
    <button class="tab" :aria-current="active === 'deals' ? 'page' : undefined" @click="emit('select', 'deals')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l6 6 4-4 8 8" /><path d="M21 11v6h-6" /></svg>
      <span>Deals</span>
      <span v-if="dealCount" class="count">{{ dealCount > 99 ? '99+' : dealCount }}</span>
    </button>

    <button v-if="isAdmin" class="tab scan" :disabled="busy" @click="emit('scan')">
      <span class="scan-disc" :class="{ busy }">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8" /></svg>
      </span>
      <span>{{ busy ? 'Reading…' : 'Scan flyer' }}</span>
    </button>

    <button class="tab" :aria-current="active === 'list' ? 'page' : undefined" @click="emit('select', 'list')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>
      <span>List</span>
      <span v-if="cartCount" class="count">{{ cartCount > 99 ? '99+' : cartCount }}</span>
    </button>
    <button class="tab" @click="emit('more')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></svg>
      <span>More</span>
    </button>
  </nav>
</template>

<style scoped>
.tabs {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  justify-content: space-around;
  align-items: stretch;
  height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
  padding: 0 4px env(safe-area-inset-bottom);
  background: var(--surface);
  border-top: 1px solid var(--hairline);
}

.tab {
  position: relative;
  flex: 1;
  max-width: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--muted);
}

.tab svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tab[aria-current="page"] { color: var(--ink); font-weight: 700; }
.tab[aria-current="page"] svg { stroke-width: 2.3; }

.count {
  position: absolute;
  top: 7px;
  left: calc(50% + 6px);
  min-width: 18px;
  padding: 0 5px;
  border-radius: 99px;
  background: var(--low);
  color: var(--surface);
  font-size: 10.5px;
  font-weight: 700;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

/* admin's scan button rises out of the bar */
.scan { color: var(--ink); font-weight: 600; }

.scan-disc {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-top: -22px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--surface);
  box-shadow: var(--shadow);
}

.scan-disc.busy { animation: pulse 1.2s ease-in-out infinite; }

@keyframes pulse { 50% { opacity: 0.55; } }

.scan:disabled { cursor: wait; }

/* desktop: same tabs, laid out as a row in the header */
.tabs.inline {
  position: static;
  height: auto;
  padding: 0;
  gap: 4px;
  background: none;
  border: none;
}

.inline .tab {
  flex: none;
  max-width: none;
  flex-direction: row;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 99px;
  font-size: 14px;
}

.inline .tab svg { width: 18px; height: 18px; }
.inline .tab:hover { color: var(--ink); background: var(--sunken); }
.inline .tab[aria-current="page"] { background: var(--ink); color: var(--surface); }

.inline .count { position: static; }

.inline .scan-disc {
  width: auto;
  height: auto;
  margin: 0;
  background: none;
  color: inherit;
  box-shadow: none;
}

.inline .scan {
  order: 10;
  margin-left: 8px;
  border: 1.5px solid var(--ink);
}

.inline .scan:hover:not(:disabled) { background: var(--ink); color: var(--surface); }
</style>
