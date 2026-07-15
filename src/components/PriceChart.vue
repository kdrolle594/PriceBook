<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  history: { type: Array, required: true }, // [{store, date, endDate, price}]
})

const SLOTS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)']
const W = 560
const H = 210
const PAD = { t: 14, r: 96, b: 24, l: 46 }

// One line per store, alphabetical so slot colors are deterministic.
// Only 4 validated slots exist — never cycle; extras go to the table below.
const allSeries = computed(() => {
  const byStore = new Map()
  for (const h of props.history) {
    if (!byStore.has(h.store)) byStore.set(h.store, [])
    byStore.get(h.store).push(h)
  }
  return [...byStore.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([store, points]) => ({
      store,
      points: [...points].sort((a, b) => a.date.localeCompare(b.date)),
    }))
})
const series = computed(() =>
  allSeries.value.slice(0, SLOTS.length).map((s, i) => ({ ...s, color: SLOTS[i] }))
)
const excluded = computed(() => allSeries.value.slice(SLOTS.length).map(s => s.store))

const shownPoints = computed(() => series.value.flatMap(s => s.points))

const xDomain = computed(() => {
  const ts = shownPoints.value.map(p => new Date(p.date + 'T00:00:00').getTime())
  return [Math.min(...ts), Math.max(...ts)]
})
const yDomain = computed(() => {
  const prices = shownPoints.value.map(p => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const pad = (max - min || max || 1) * 0.15
  return [Math.max(0, min - pad), max + pad]
})

function x(date) {
  const [min, max] = xDomain.value
  const t = new Date(date + 'T00:00:00').getTime()
  if (max === min) return PAD.l + (W - PAD.l - PAD.r) / 2
  return PAD.l + ((t - min) / (max - min)) * (W - PAD.l - PAD.r)
}
function y(price) {
  const [min, max] = yDomain.value
  return PAD.t + (1 - (price - min) / (max - min)) * (H - PAD.t - PAD.b)
}

const yTicks = computed(() => {
  const [min, max] = yDomain.value
  return [min, (min + max) / 2, max].map(v => ({ v, y: y(v) }))
})

const xLabels = computed(() => {
  const [min, max] = xDomain.value
  const fmt = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return { first: fmt(min), last: max === min ? '' : fmt(max) }
})

function fmtDate(iso) {
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function fmtPrice(v) {
  return `$${v.toFixed(2)}`
}

// Direct labels at each line's last point, nudged apart when they collide
const endLabels = computed(() => {
  const labels = series.value.map(s => {
    const last = s.points[s.points.length - 1]
    return { store: s.store, color: s.color, x: x(last.date) + 8, y: y(last.price) + 4 }
  }).sort((a, b) => a.y - b.y)
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y - labels[i - 1].y < 13) labels[i].y = labels[i - 1].y + 13
  }
  return labels
})

const hover = ref(null) // {xPct, yPct, store, date, endDate, price}

function onHover(s, p) {
  hover.value = {
    xPct: (x(p.date) / W) * 100,
    yPct: (y(p.price) / H) * 100,
    store: s.store,
    date: p.date,
    endDate: p.endDate,
    price: p.price,
  }
}
</script>

<template>
  <figure class="chart">
    <div v-if="series.length > 1" class="legend">
      <span v-for="s in series" :key="s.store" class="legend-item">
        <span class="dot" :style="{ background: s.color }" aria-hidden="true"></span>
        {{ s.store }}
      </span>
    </div>

    <div class="plot">
      <svg :viewBox="`0 0 ${W} ${H}`" role="img" aria-label="Price over time by store" @mouseleave="hover = null">
        <!-- grid + y labels -->
        <g v-for="t in yTicks" :key="t.v">
          <line :x1="PAD.l" :x2="W - PAD.r" :y1="t.y" :y2="t.y" class="grid" />
          <text :x="PAD.l - 8" :y="t.y + 3.5" class="tick" text-anchor="end">{{ fmtPrice(t.v) }}</text>
        </g>

        <!-- x labels -->
        <text :x="PAD.l" :y="H - 6" class="tick">{{ xLabels.first }}</text>
        <text v-if="xLabels.last" :x="W - PAD.r" :y="H - 6" class="tick" text-anchor="end">
          {{ xLabels.last }}
        </text>

        <!-- lines + markers -->
        <g v-for="s in series" :key="s.store">
          <polyline
            v-if="s.points.length > 1"
            :points="s.points.map(p => `${x(p.date)},${y(p.price)}`).join(' ')"
            fill="none"
            :stroke="s.color"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
          <g v-for="p in s.points" :key="p.date">
            <circle :cx="x(p.date)" :cy="y(p.price)" r="4" :fill="s.color" class="marker" />
            <!-- oversized invisible hit target -->
            <circle
              :cx="x(p.date)" :cy="y(p.price)" r="12" fill="transparent"
              @mouseenter="onHover(s, p)"
            />
          </g>
        </g>

        <!-- direct labels (text ink, colored mark carries identity) -->
        <text v-for="l in endLabels" :key="l.store" :x="l.x" :y="l.y" class="end-label">
          {{ l.store }}
        </text>
      </svg>

      <div
        v-if="hover"
        class="tooltip mono"
        :style="{ left: hover.xPct + '%', top: hover.yPct + '%' }"
      >
        <span class="tt-price">{{ fmtPrice(hover.price) }}</span>
        {{ hover.store }} ·
        {{ fmtDate(hover.date) }}<template v-if="hover.endDate">–{{ fmtDate(hover.endDate) }}</template>
      </div>
    </div>

    <figcaption v-if="excluded.length" class="caption">
      Not charted (only 4 stores fit): {{ excluded.join(', ') }} — see the history below.
    </figcaption>
  </figure>
</template>

<style scoped>
.chart {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 12px;
  color: var(--muted);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.plot { position: relative; }

svg { width: 100%; height: auto; }

.grid {
  stroke: var(--hairline);
  stroke-width: 1;
}

.tick {
  font-family: var(--font-mono);
  font-size: 10px;
  fill: var(--muted);
}

.marker {
  stroke: var(--surface);
  stroke-width: 2;
}

.end-label {
  font-family: var(--font-body);
  font-size: 11px;
  fill: var(--muted);
}

.tooltip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 12px));
  background: var(--surface-raised);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow);
  padding: 4px 9px;
  font-size: 11.5px;
  color: var(--muted);
  white-space: nowrap;
  pointer-events: none;
}

.tt-price {
  color: var(--ink);
  font-weight: 600;
}

.caption {
  font-size: 11.5px;
  color: var(--faint);
}
</style>
