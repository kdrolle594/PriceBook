<script setup>
import { computed } from 'vue'

// The shelf check: today's price as a dot on a track that runs from the
// lowest price ever seen (left) to the highest (right).
const props = defineProps({
  check: { type: Object, required: true }, // shelfCheck() result
  large: { type: Boolean, default: false },
})

const money = v => `$${v.toFixed(2)}`

// keep the dot fully on the track at either end
const left = computed(() => `calc((100% - var(--dot)) * ${props.check.pct ?? 0.5})`)

const label = computed(() => {
  const c = props.check
  return `Shelf check: ${c.verdict}. Today ${money(c.current)}, lowest seen ${money(c.min)}, highest ${money(c.max)}.`
})
</script>

<template>
  <div class="meter" :class="[`tone-${check.tone}`, { large }]" role="img" :aria-label="label">
    <span class="end">{{ money(check.min) }}</span>
    <span class="track" aria-hidden="true">
      <span v-if="check.tone !== 'flat'" class="fill" :style="{ width: `${(check.pct ?? 0.5) * 100}%` }"></span>
      <span class="dot" :style="{ left }"></span>
    </span>
    <span class="end">{{ money(check.max) }}</span>
  </div>
</template>

<style scoped>
.meter {
  --dot: 12px;
  --track: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--muted);
}

.meter.large { --dot: 18px; --track: 10px; gap: 12px; }

.end {
  flex: none;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.large .end { font-size: 13px; font-weight: 500; }

.track {
  position: relative;
  flex: 1;
  min-width: 48px;
  height: var(--dot);
  display: flex;
  align-items: center;
}

/* the rail */
.track::before {
  content: "";
  position: absolute;
  inset: calc((var(--dot) - var(--track)) / 2) 0;
  border-radius: 99px;
  background: var(--sunken);
}

/* distance above the low, tinted by how far it is */
.fill {
  position: absolute;
  left: 0;
  top: calc((var(--dot) - var(--track)) / 2);
  height: var(--track);
  border-radius: 99px;
  background: color-mix(in srgb, var(--tone) 28%, transparent);
}

.dot {
  position: absolute;
  top: 0;
  width: var(--dot);
  height: var(--dot);
  border-radius: 50%;
  background: var(--tone);
  box-shadow: 0 0 0 2px var(--surface);
}

.tone-low, .tone-good { --tone: var(--low); }
.tone-high { --tone: var(--high); }
.tone-mid, .tone-flat, .tone-none { --tone: var(--muted); }
.tone-low .end:first-child { color: var(--low); font-weight: 600; }
</style>
