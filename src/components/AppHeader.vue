<script setup>
const q = defineModel('q', { type: String })

defineProps({
  flyerCount: { type: Number, required: true },
  showSearch: { type: Boolean, default: true },
})
</script>

<template>
  <header class="head">
    <div class="head-inner">
      <div class="brand">
        <span class="mark" aria-hidden="true">
          <svg viewBox="0 0 32 32"><rect x="3" y="14" width="26" height="4" rx="2" /><circle cx="10" cy="16" r="5.5" /></svg>
        </span>
        <div>
          <h1>Shelf Check</h1>
          <p v-if="flyerCount" class="tagline">Prices from {{ flyerCount }} {{ flyerCount === 1 ? 'flyer' : 'flyers' }}</p>
        </div>
      </div>

      <label v-if="showSearch" class="search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input
          v-model="q"
          type="search"
          placeholder="Search rice, sugar, tuna…"
          aria-label="Search items"
        >
      </label>

      <slot />
    </div>
  </header>
</template>

<style scoped>
.head {
  position: sticky;
  top: 0;
  z-index: 10;
  background: color-mix(in srgb, var(--bg) 90%, transparent);
  backdrop-filter: blur(10px);
}

.head-inner {
  max-width: var(--col);
  margin: 0 auto;
  padding: 14px 16px 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-right: auto;
}

.mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--ink);
}

.mark svg { width: 24px; height: 24px; }
.mark rect { fill: color-mix(in srgb, var(--surface) 35%, transparent); }
.mark circle { fill: var(--low); stroke: var(--ink); stroke-width: 2; }

h1 {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.tagline {
  font-size: 12.5px;
  color: var(--muted);
}

.search {
  flex: 1 1 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  height: 48px;
  background: var(--surface);
  border: 1.5px solid var(--hairline);
  border-radius: 99px;
  cursor: text;
}

.search:focus-within {
  border-color: var(--ink);
}

.search svg {
  flex: none;
  width: 20px;
  height: 20px;
  fill: none;
  stroke: var(--muted);
  stroke-width: 2;
  stroke-linecap: round;
}

.search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  background: none;
  border: none;
  font-size: 16px;
}

.search input:focus { outline: none; }
.search input::placeholder { color: var(--faint); }

@media (min-width: 960px) {
  .head { border-bottom: 1px solid var(--hairline); }
  .head-inner {
    max-width: var(--wide);
    flex-wrap: nowrap;
    padding: 12px 24px;
  }
  .brand { margin-right: 0; }
  .search { flex: 1 1 auto; max-width: 440px; height: 44px; }
}
</style>
