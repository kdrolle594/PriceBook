<script setup>
import { ref } from 'vue'

defineProps({
  flyers: { type: Array, required: true },
  canDelete: { type: Boolean, default: true },
})

const emit = defineEmits(['delete'])

const open = ref(false)
const confirmId = ref(null)

function fmtDate(iso) {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  if (isNaN(d)) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function onDelete(id) {
  if (confirmId.value !== id) {
    confirmId.value = id
    return
  }
  confirmId.value = null
  emit('delete', id)
}
</script>

<template>
  <section v-if="flyers.length" class="log">
    <button class="log-toggle" :aria-expanded="String(open)" @click="open = !open; confirmId = null">
      <span class="log-title">Scanned flyers</span>
      <span class="log-count">{{ flyers.length }}</span>
      <span class="caret" :class="{ open }" aria-hidden="true">▾</span>
    </button>

    <ul v-if="open" class="log-list">
      <li v-for="f in flyers" :key="f.id" class="log-row">
        <div class="log-id">
          <span class="log-store">{{ f.store }}</span>
          <span class="log-meta">
            {{ fmtDate(f.startDate) }}<template v-if="f.endDate"> to {{ fmtDate(f.endDate) }}</template>,
            {{ f.itemCount }} item{{ f.itemCount === 1 ? '' : 's' }}
          </span>
        </div>
        <button
          v-if="canDelete"
          class="log-delete"
          :class="{ arming: confirmId === f.id }"
          @click="onDelete(f.id)"
        >
          {{ confirmId === f.id ? 'Really delete its prices?' : 'Delete' }}
        </button>
        <button
          v-if="confirmId === f.id"
          class="log-keep"
          @click="confirmId = null"
        >Keep</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.log {
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: 0 0 0 1px var(--hairline);
}

.log-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  text-align: left;
  border-radius: var(--radius);
}

.log-toggle:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }

.log-title {
  font-size: 14px;
  font-weight: 600;
}

.log-count {
  font-size: 11.5px;
  color: var(--muted);
  background: var(--bg);
  border: 1px solid var(--hairline);
  border-radius: 99px;
  padding: 0 7px;
}

.caret {
  margin-left: auto;
  color: var(--faint);
  font-size: 11px;
  transition: transform 0.18s ease;
}

.caret.open { transform: rotate(180deg); }

.log-list {
  list-style: none;
  padding: 2px 14px 10px;
}

.log-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-top: 1px solid var(--hairline);
}

.log-row:first-child { border-top: none; }

.log-id {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.log-store {
  font-size: 13.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-meta {
  font-size: 11.5px;
  color: var(--muted);
}

.log-delete {
  flex: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
}

.log-delete:hover, .log-delete.arming {
  color: var(--danger);
  background: var(--danger-soft);
}

.log-keep {
  flex: none;
  font-size: 12px;
  color: var(--muted);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
}

.log-keep:hover { color: var(--ink); background: var(--bg); }
</style>
