<script setup>
const q = defineModel('q', { type: String })
const filter = defineModel('filter', { type: String })

const options = [
  { value: 'all', label: 'All' },
  { value: 'deals', label: 'Lows' },
  { value: 'multi', label: 'History' },
]
</script>

<template>
  <div class="filters">
    <input
      v-model="q"
      class="search"
      type="search"
      placeholder="Search items… (rice, sugar, tuna)"
      aria-label="Search items"
    >
    <div class="segment" role="radiogroup" aria-label="Filter items">
      <button
        v-for="opt in options"
        :key="opt.value"
        class="seg-btn"
        :class="{ active: filter === opt.value }"
        role="radio"
        :aria-checked="filter === opt.value"
        @click="filter = opt.value"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.search {
  flex: 1;
  min-width: 180px;
  padding: 9px 14px;
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: var(--radius);
  font-size: 14px;
}

.search::placeholder { color: var(--faint); }

.search:focus {
  outline: none;
  border-color: var(--hairline-strong);
  box-shadow: 0 0 0 3px var(--low-soft);
}

.segment {
  display: flex;
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: var(--radius);
  padding: 3px;
  gap: 2px;
}

.seg-btn {
  padding: 5px 14px;
  border-radius: calc(var(--radius) - 4px);
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  transition: background 0.15s ease, color 0.15s ease;
}

.seg-btn:hover { color: var(--ink); }

.seg-btn.active {
  background: var(--ink);
  color: var(--bg);
  font-weight: 600;
}
</style>
