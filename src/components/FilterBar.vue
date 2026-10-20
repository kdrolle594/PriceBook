<script setup>
import { computed } from 'vue'

const filter = defineModel('filter', { type: String })

const props = defineProps({
  counts: { type: Object, required: true }, // { all, deals, sale, multi }
})

const options = computed(() => [
  { value: 'all', label: 'All', n: props.counts.all },
  { value: 'deals', label: 'Lowest seen', n: props.counts.deals },
  { value: 'sale', label: 'On sale', n: props.counts.sale },
  { value: 'multi', label: 'Has history', n: props.counts.multi },
])
</script>

<template>
  <div class="chips" role="radiogroup" aria-label="Filter items">
    <button
      v-for="opt in options"
      :key="opt.value"
      class="chip"
      :class="{ active: filter === opt.value, lows: opt.value === 'deals' }"
      role="radio"
      :aria-checked="filter === opt.value"
      @click="filter = opt.value"
    >
      {{ opt.label }}
      <span class="n">{{ opt.n }}</span>
    </button>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  margin: 0 -16px;
  padding: 2px 16px;
}

.chips::-webkit-scrollbar { display: none; }

.chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border-radius: 99px;
  background: var(--surface);
  border: 1.5px solid var(--hairline);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.chip:hover { border-color: var(--hairline-strong); }

.n {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.lows .n { color: var(--low); }

.chip.active {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--surface);
  font-weight: 600;
}

.chip.active .n { color: inherit; opacity: 0.75; }

@media (min-width: 960px) {
  .chips { margin: 0; padding: 2px 0; flex-wrap: wrap; }
}
</style>
