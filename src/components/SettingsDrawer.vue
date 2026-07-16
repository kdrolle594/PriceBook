<script setup>
import { ref, watch } from 'vue'
import AdminLogin from './AdminLogin.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  hasData: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  userEmail: { type: String, default: '' },
  hasLocalBackup: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'clear-all', 'export', 'import', 'migrate', 'sign-out'])

const confirmClear = ref(false)
const importInput = ref(null)

watch(() => props.open, (isOpen) => {
  if (isOpen) confirmClear.value = false
})

function clearAll() {
  if (!confirmClear.value) {
    confirmClear.value = true
    return
  }
  emit('clear-all')
  confirmClear.value = false
}

function onImportPick(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (file) emit('import', file)
}

function onKeydown(e) {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="scrim" @click.self="emit('close')" @keydown="onKeydown">
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="Settings">
        <header class="drawer-head">
          <h2>Settings</h2>
          <button class="close" aria-label="Close settings" @click="emit('close')">✕</button>
        </header>

        <section class="section">
          <span class="label">Account</span>
          <template v-if="userEmail">
            <p class="hint">
              Signed in as <span class="mono">{{ userEmail }}</span>
              <template v-if="isAdmin"> · admin</template>
            </p>
            <button class="ghost solid" @click="emit('sign-out')">Sign out</button>
          </template>
          <template v-else>
            <p class="hint">
              No account needed to browse prices or build a shopping list.
              Admins sign in here to scan flyers and manage the book.
            </p>
            <AdminLogin />
          </template>
        </section>

        <section v-if="hasData || isAdmin" class="section">
          <span class="label">Backup</span>
          <p class="hint">
            Download the price book as a JSON file<template v-if="isAdmin">,
            or restore one — restoring adds anything the book doesn't already have</template>.
          </p>
          <div class="backup-row">
            <button v-if="hasData" class="ghost solid" @click="emit('export')">Export backup</button>
            <template v-if="isAdmin">
              <button class="ghost solid" @click="importInput?.click()">Restore from backup</button>
              <input
                ref="importInput"
                type="file"
                accept="application/json,.json"
                hidden
                @change="onImportPick"
              >
              <button v-if="hasLocalBackup" class="ghost solid" @click="emit('migrate')">
                Migrate this browser's old data
              </button>
            </template>
          </div>
        </section>

        <section v-if="hasData && isAdmin" class="section danger-zone">
          <span class="label">Data</span>
          <p class="hint">Deletes every tracked price for everyone — export a backup first.</p>
          <button class="danger" @click="clearAll">
            {{ confirmClear ? 'Really delete all tracked prices?' : 'Clear all data' }}
          </button>
          <button v-if="confirmClear" class="ghost" @click="confirmClear = false">Keep my data</button>
        </section>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  z-index: 50;
  display: flex;
  justify-content: flex-end;
  animation: fade 0.18s ease;
}

.drawer {
  width: min(380px, 100vw);
  height: 100%;
  background: var(--bg);
  border-left: 1px solid var(--hairline);
  padding: 20px 22px;
  overflow-y: auto;
  animation: slide 0.22s ease;
}

@keyframes fade { from { opacity: 0; } }
@keyframes slide { from { transform: translateX(24px); opacity: 0; } }

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
}

h2 {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
}

.close {
  color: var(--muted);
  font-size: 14px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
}

.close:hover { color: var(--ink); background: var(--surface); }

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 0;
}

.section + .section { border-top: 1px solid var(--hairline); }

.label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.hint {
  font-size: 13px;
  color: var(--muted);
}

.ghost {
  align-self: flex-start;
  padding: 8px 12px;
  color: var(--muted);
  font-size: 13px;
  border-radius: var(--radius-sm);
}

.ghost:hover { color: var(--ink); background: var(--surface); }

.backup-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ghost.solid {
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--hairline);
  font-weight: 600;
}

.ghost.solid:hover { border-color: var(--hairline-strong); }

.danger {
  align-self: flex-start;
  padding: 8px 14px;
  background: var(--danger-soft);
  color: var(--danger);
  font-weight: 600;
  font-size: 13.5px;
  border-radius: var(--radius-sm);
}
</style>
