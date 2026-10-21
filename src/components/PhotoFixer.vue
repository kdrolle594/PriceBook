<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { cropPhoto, shrinkPhoto } from '../lib/photos.js'

// Fix one item's photo: drag a box on the flyer, or pick another picture.
const props = defineProps({
  file: { type: File, default: null },  // the flyer; null when fixing a saved item
  box: { type: Array, default: null },  // current box, 0–1000 units
  name: { type: String, required: true },
})

const emit = defineEmits(['use', 'none', 'cancel'])

const flyerUrl = props.file ? URL.createObjectURL(props.file) : ''
onBeforeUnmount(() => { if (flyerUrl) URL.revokeObjectURL(flyerUrl) })

const draft = ref(props.box ? [...props.box] : null)
const stage = ref(null)
const picker = ref(null)
const busy = ref(false)
const err = ref('')
let start = null

const boxStyle = computed(() => {
  if (!draft.value) return null
  const [x1, y1, x2, y2] = draft.value
  return {
    left: `${x1 / 10}%`,
    top: `${y1 / 10}%`,
    width: `${(x2 - x1) / 10}%`,
    height: `${(y2 - y1) / 10}%`,
  }
})

function at(e) {
  const r = stage.value.getBoundingClientRect()
  const clamp = v => Math.min(1000, Math.max(0, Math.round(v)))
  return [clamp(((e.clientX - r.left) / r.width) * 1000), clamp(((e.clientY - r.top) / r.height) * 1000)]
}

function down(e) {
  stage.value.setPointerCapture(e.pointerId)
  start = at(e)
  draft.value = [...start, ...start]
}

function move(e) {
  if (!start) return
  const [x, y] = at(e)
  draft.value = [Math.min(start[0], x), Math.min(start[1], y), Math.max(start[0], x), Math.max(start[1], y)]
}

function up() {
  start = null
  const b = draft.value
  if (b && (b[2] - b[0] < 10 || b[3] - b[1] < 10)) draft.value = props.box ? [...props.box] : null
}

async function useBox() {
  busy.value = true
  err.value = ''
  try {
    // a box drawn by hand is exact; only the scan's boxes get padding
    const exact = draft.value.join() !== (props.box || []).join()
    emit('use', { blob: await cropPhoto(props.file, draft.value, exact ? 0 : undefined), box: draft.value })
  } catch (e) {
    err.value = e.message
  } finally {
    busy.value = false
  }
}

async function onPick(e) {
  const f = e.target.files[0]
  e.target.value = ''
  if (!f) return
  busy.value = true
  err.value = ''
  try {
    emit('use', { blob: await shrinkPhoto(f), box: null })
  } catch (ex) {
    err.value = ex.message
  } finally {
    busy.value = false
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') emit('cancel')
}

const cancelBtn = ref(null)
onMounted(() => cancelBtn.value?.focus())
</script>

<template>
  <Teleport to="body">
    <div class="scrim" @click.self="emit('cancel')" @keydown="onKeydown">
      <div class="card" role="dialog" aria-modal="true" :aria-label="`Photo for ${name}`">
        <header class="head">
          <h2>Photo for {{ name }}</h2>
          <p v-if="file" class="hint">Drag a box around the product on the flyer.</p>
          <p v-else class="hint">Pick a picture, or take one with your phone's camera.</p>
        </header>

        <div v-if="file" class="frame">
          <div
            ref="stage"
            class="stage"
            @pointerdown.prevent="down"
            @pointermove="move"
            @pointerup="up"
            @pointercancel="up"
          >
            <img :src="flyerUrl" alt="" draggable="false">
            <span v-if="boxStyle" class="box" :style="boxStyle" aria-hidden="true"></span>
          </div>
        </div>

        <p v-if="err" class="err" role="alert">{{ err }}</p>

        <footer class="foot">
          <button class="ghost" :disabled="busy" @click="picker?.click()">{{ file ? 'Pick another photo' : 'Pick a photo' }}</button>
          <input ref="picker" type="file" accept="image/*" hidden @change="onPick">
          <button class="ghost" :disabled="busy" @click="emit('none')">No photo</button>
          <span class="spacer"></span>
          <button ref="cancelBtn" class="ghost" @click="emit('cancel')">Cancel</button>
          <button v-if="file" class="primary" :disabled="!draft || busy" @click="useBox">Use this photo</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: var(--scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.card {
  width: min(720px, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 18px 20px;
  box-shadow: var(--shadow);
}

h2 {
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 700;
}

.hint { font-size: 13px; color: var(--muted); }

.frame {
  min-height: 0;
  display: flex;
  justify-content: center;
  background: var(--sunken);
  border-radius: var(--radius-sm);
  overflow: auto;
}

.stage {
  position: relative;
  touch-action: none;
  cursor: crosshair;
  user-select: none;
}

.stage img {
  display: block;
  max-width: 100%;
  max-height: 62dvh;
  pointer-events: none;
}

.box {
  position: absolute;
  border: 2px solid var(--low);
  border-radius: 4px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
}

.err { font-size: 13px; color: var(--danger); }

.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.spacer { flex: 1; }

.ghost {
  padding: 8px 12px;
  font-size: 13.5px;
  color: var(--muted);
  border-radius: var(--radius-sm);
}

.ghost:hover:not(:disabled) { color: var(--ink); background: var(--sunken); }

.primary {
  padding: 8px 18px;
  background: var(--ink);
  color: var(--surface);
  font-weight: 600;
  font-size: 13.5px;
  border-radius: var(--radius-sm);
}

.primary:disabled, .ghost:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
