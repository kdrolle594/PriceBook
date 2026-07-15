<script setup>
import { computed } from 'vue'

const props = defineProps({
  // prices in chronological order (oldest → newest)
  prices: { type: Array, required: true },
  width: { type: Number, default: 72 },
  height: { type: Number, default: 24 },
})

const PAD = 3

const points = computed(() => {
  const p = props.prices
  if (p.length < 2) return ''
  const min = Math.min(...p)
  const max = Math.max(...p)
  const span = max - min || 1
  const stepX = (props.width - PAD * 2) / (p.length - 1)
  return p
    .map((v, i) => {
      const x = PAD + i * stepX
      const y = PAD + (1 - (v - min) / span) * (props.height - PAD * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

const lastPoint = computed(() => {
  const pts = points.value.split(' ')
  const [x, y] = (pts[pts.length - 1] || '0,0').split(',')
  return { x: Number(x), y: Number(y) }
})

// newest price at or below the min of the rest → trending to a low
const endsLow = computed(() => {
  const p = props.prices
  return p[p.length - 1] <= Math.min(...p)
})
</script>

<template>
  <svg
    v-if="prices.length >= 2"
    class="spark"
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    aria-hidden="true"
  >
    <polyline
      class="spark-line"
      :points="points"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle
      :cx="lastPoint.x"
      :cy="lastPoint.y"
      r="2.5"
      :fill="endsLow ? 'var(--low)' : 'var(--high)'"
    />
  </svg>
</template>

<style scoped>
.spark {
  color: var(--faint);
  flex: none;
}

.spark-line {
  stroke-dasharray: 300;
  stroke-dashoffset: 300;
  animation: draw 0.9s ease-out forwards;
}

@keyframes draw {
  to { stroke-dashoffset: 0; }
}
</style>
