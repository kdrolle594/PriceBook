<script setup>
import { ref } from 'vue'

const props = defineProps({
  busy: { type: Boolean, default: false },
  progress: { type: String, default: '' },
})

const emit = defineEmits(['files'])

const dragging = ref(false)
const input = ref(null)

function pick() {
  if (!props.busy) input.value?.click()
}

function onChange(e) {
  const files = [...e.target.files]
  e.target.value = ''
  if (files.length) emit('files', files)
}

function onDrop(e) {
  dragging.value = false
  if (props.busy) return
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))
  if (files.length) emit('files', files)
}
</script>

<template>
  <button
    class="drop"
    :class="{ dragging, busy }"
    type="button"
    @click="pick"
    @dragover.prevent="!busy && (dragging = true)"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
  >
    <input
      ref="input"
      type="file"
      accept="image/*"
      multiple
      hidden
      @change="onChange"
    >
    <template v-if="busy">
      <span class="drop-title">
        <span class="pulse" aria-hidden="true"></span>
        {{ progress || 'Reading flyer…' }}
      </span>
      <span class="drop-sub">Extracting prices — this takes a few seconds</span>
    </template>
    <template v-else>
      <span class="drop-title">+ Drop this week's flyer</span>
      <span class="drop-sub">Photo or screenshot — prices are extracted automatically</span>
    </template>
  </button>
</template>

<style scoped>
.drop {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 26px 20px;
  background: var(--surface);
  border: 1.5px dashed var(--hairline-strong);
  border-radius: var(--radius);
  transition: border-color 0.15s ease, background 0.15s ease;
}

.drop:hover:not(.busy) {
  border-color: var(--low);
  background: var(--low-soft);
}

.drop.dragging {
  border-color: var(--low);
  background: var(--low-soft);
  border-style: solid;
}

.drop.busy { cursor: wait; border-color: var(--hairline); }

.drop-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}

.drop-sub {
  font-size: 13px;
  color: var(--muted);
}

.pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--low);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.75); }
}
</style>
