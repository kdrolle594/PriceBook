<script setup>
defineProps({
  dealCount: { type: Number, required: true },
  saleCount: { type: Number, required: true },
  storeCount: { type: Number, required: true },
  multiCount: { type: Number, required: true },
})
</script>

<template>
  <dl class="stats">
    <div class="stat">
      <dt>At historic low</dt>
      <dd class="mono" :class="{ 'has-lows': dealCount > 0 }">{{ dealCount }}</dd>
    </div>
    <div class="stat">
      <dt>On sale now</dt>
      <dd class="mono">{{ saleCount }}</dd>
    </div>
    <div class="stat">
      <dt>Stores</dt>
      <dd class="mono">{{ storeCount }}</dd>
    </div>
    <div class="stat">
      <dt>With history</dt>
      <dd class="mono">{{ multiCount }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.stats {
  display: flex;
  border-top: 1px solid var(--hairline);
  border-bottom: 1px solid var(--hairline);
}

.stat {
  flex: 1;
  padding: 12px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat + .stat { border-left: 1px solid var(--hairline); padding-left: 16px; }

dt {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

dd {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.01em;
}

dd.has-lows { color: var(--low); }
</style>
