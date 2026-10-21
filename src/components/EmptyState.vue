<script setup>
defineProps({
  isAdmin: { type: Boolean, default: true },
})
</script>

<template>
  <div class="empty">
    <template v-if="!isAdmin">
      <p class="empty-title">No prices yet</p>
      <p class="empty-body">
        Prices show up here once an admin scans the first flyer.
        Check back after this week's flyers are in.
      </p>
    </template>
    <template v-else>
      <p class="empty-title">No prices yet</p>
      <p class="empty-body">
        Scan this week's flyer to start. After two or more flyers, every item
        gets a shelf check that shows whether its "sale" is really the lowest price.
      </p>
      <ol class="steps">
        <li><span class="step-n">1</span> Snap or screenshot a flyer</li>
        <li><span class="step-n">2</span> Tap Scan flyer and check the prices it read</li>
        <li><span class="step-n">3</span> Look for <span class="low-word">Lowest price seen</span> on the shelf check</li>
      </ol>
    </template>
  </div>
</template>

<style scoped>
.empty {
  text-align: center;
  padding: 56px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.empty-title {
  font-family: var(--font-display);
  font-size: 21px;
  font-weight: 700;
}

.empty-body {
  color: var(--muted);
  font-size: 14px;
  max-width: 380px;
}

.steps {
  margin-top: 14px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  font-size: 14px;
  color: var(--muted);
}

.steps li {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step-n {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--hairline-strong);
  border-radius: 50%;
  font-size: 11px;
  color: var(--ink);
  flex: none;
}

.low-word { color: var(--low); font-weight: 600; }
</style>
