<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import AppHeader from './components/AppHeader.vue'
import UploadZone from './components/UploadZone.vue'
import FilterBar from './components/FilterBar.vue'
import ItemRow from './components/ItemRow.vue'
import EmptyState from './components/EmptyState.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import FlyerReview from './components/FlyerReview.vue'
import FlyerLog from './components/FlyerLog.vue'
import ItemDetail from './components/ItemDetail.vue'
import AddPriceForm from './components/AddPriceForm.vue'
import CartView from './components/CartView.vue'
import TabBar from './components/TabBar.vue'
import { usePriceBook } from './composables/usePriceBook.js'
import { useCart } from './composables/useCart.js'
import { useAuth } from './composables/useAuth.js'
import { extractFlyer } from './lib/extractFlyer.js'
import { isConfigured } from './lib/supabase.js'

const {
  items, flyers, sortedFlyers, loading, q, filter,
  stores, dealCount, multiCount, saleCount, shown,
  loadAll, mergeFlyer, deleteFlyer, exportJSON, importJSON, localBackup, clearAll,
} = usePriceBook()

// Browsing needs no account — auth only unlocks admin tools, via Settings.
const { user, isAdmin, signOut } = isConfigured
  ? useAuth()
  : { user: ref(null), isAdmin: ref(false), signOut: () => {} }

const { count: cartCount } = useCart()

const settingsOpen = ref(false)
const view = ref('book') // 'book' | 'cart'

// Desktop docks the item detail beside the list; phones get a bottom sheet.
const wideQuery = window.matchMedia('(min-width: 960px)')
const isWide = ref(wideQuery.matches)
const onWide = e => { isWide.value = e.matches }
wideQuery.addEventListener('change', onWide)
onBeforeUnmount(() => wideQuery.removeEventListener('change', onWide))

const activeTab = computed(() => {
  if (view.value === 'cart') return 'list'
  return filter.value === 'deals' ? 'deals' : 'prices'
})

function onTab(tab) {
  if (tab === 'list') {
    view.value = 'cart'
    return
  }
  view.value = 'book'
  filter.value = tab === 'deals' ? 'deals' : 'all'
}

const uploader = ref(null)
async function onScan() {
  view.value = 'book'
  await nextTick()
  uploader.value?.pick()
}

const filterCounts = computed(() => ({
  all: items.value.length,
  deals: dealCount.value,
  sale: saleCount.value,
  multi: multiCount.value,
}))
const busy = ref(false)
const progress = ref('')
const status = ref('')
const isErr = ref(false)

// Extracted flyers waiting for the user to review before they're merged.
const pendingReviews = ref([])
const currentReview = computed(() => pendingReviews.value[0] || null)
const knownCanonicals = computed(() => items.value.map(it => it.canonical))

const hasLocalBackup = computed(() => Boolean(localBackup()))

// Item detail modal — tracked by id so it survives refetches and closes on delete
const detailId = ref(null)
const detailItem = computed(() => items.value.find(i => i.id === detailId.value) || null)

const manualAddOpen = ref(false)

// Reads are public — load straight away, session or not.
if (isConfigured) {
  loadAll().catch(err => fail(`Could not load prices: ${err.message}`))
}

function fail(msg) {
  status.value = msg
  isErr.value = true
}

async function onFiles(files) {
  busy.value = true
  isErr.value = false
  const errors = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    progress.value = files.length > 1
      ? `Reading flyer ${i + 1} of ${files.length}…`
      : `Reading ${file.name}…`
    try {
      const parsed = await extractFlyer(file, knownCanonicals.value)
      pendingReviews.value.push({ fileName: file.name, parsed })
    } catch (err) {
      errors.push(`${file.name}: ${err.message}`)
    }
  }
  if (errors.length) fail(errors.join(' · '))
  busy.value = false
  progress.value = ''
}

async function onReviewSave(edited) {
  try {
    const { added, updated } = await mergeFlyer(edited)
    status.value = `${edited.s}: ${added} new, ${updated} updated`
    isErr.value = false
    pendingReviews.value.shift()
  } catch (err) {
    fail(`Could not save flyer: ${err.message}`)
  }
}

function onReviewDiscard() {
  const { fileName } = pendingReviews.value.shift()
  status.value = `${fileName}: discarded`
  isErr.value = false
}

async function onDeleteFlyer(id) {
  const flyer = flyers.value.find(f => f.id === id)
  try {
    await deleteFlyer(id)
    status.value = flyer ? `Removed ${flyer.store} flyer and its prices.` : 'Flyer removed.'
    isErr.value = false
  } catch (err) {
    fail(`Could not delete flyer: ${err.message}`)
  }
}

async function onClearAll() {
  try {
    await clearAll()
    settingsOpen.value = false
    status.value = 'All data cleared.'
    isErr.value = false
  } catch (err) {
    fail(`Could not clear data: ${err.message}`)
  }
}

function onExport() {
  const blob = new Blob([exportJSON()], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `shelf-check-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

async function onImport(file) {
  try {
    await importJSON(JSON.parse(await file.text()))
    settingsOpen.value = false
    status.value = `Restored backup — ${items.value.length} items tracked.`
    isErr.value = false
  } catch (err) {
    settingsOpen.value = false
    fail(`Restore failed: ${err.message}`)
  }
}

// One-time pull of this browser's pre-Supabase localStorage data.
async function onMigrate() {
  try {
    await importJSON(localBackup())
    settingsOpen.value = false
    status.value = `Migrated this browser's data — ${items.value.length} items tracked.`
    isErr.value = false
  } catch (err) {
    settingsOpen.value = false
    fail(`Migration failed: ${err.message}`)
  }
}

async function onSignOut() {
  settingsOpen.value = false
  await signOut()
}
</script>

<template>
  <!-- Supabase not configured yet: point at the setup steps instead of crashing -->
  <div v-if="!isConfigured" class="setup">
    <h1>Almost there</h1>
    <p>Shelf Check syncs through Supabase, but this build isn't connected yet.</p>
    <ol>
      <li>Create a free project at <span class="mono">supabase.com</span></li>
      <li>Run <span class="mono">supabase/schema.sql</span> in the SQL editor</li>
      <li>Copy <span class="mono">.env.example</span> to <span class="mono">.env.local</span> and fill in your project URL and anon key</li>
      <li>Restart the dev server, create an account (Settings → Account), then make yourself admin:<br>
        <span class="mono">update profiles set is_admin = true where email = 'you@…';</span></li>
    </ol>
  </div>

  <template v-else>
    <AppHeader v-model:q="q" :flyer-count="flyers.length" :show-search="view === 'book'">
      <TabBar
        v-if="isWide"
        inline
        :active="activeTab"
        :cart-count="cartCount"
        :deal-count="dealCount"
        :is-admin="isAdmin"
        :busy="busy"
        @select="onTab"
        @scan="onScan"
        @more="settingsOpen = true"
      />
    </AppHeader>

    <main class="page" :class="{ split: isWide && view === 'book' && items.length }">
      <CartView v-if="view === 'cart'" />

      <template v-else>
        <div class="list-col">
          <UploadZone
            v-if="isAdmin"
            ref="uploader"
            :busy="busy"
            :progress="progress"
            @files="onFiles"
          />

          <div v-if="isAdmin" class="manual">
            <button class="manual-toggle" @click="manualAddOpen = !manualAddOpen">
              {{ manualAddOpen ? 'Cancel' : 'Add a price you saw in the store' }}
            </button>
            <AddPriceForm
              v-if="manualAddOpen"
              :stores="stores"
              @done="status = $event; isErr = false; manualAddOpen = false"
              @error="fail($event)"
            />
          </div>

          <p class="status" :class="{ err: isErr, shown: status }" role="status">{{ status }}</p>

          <template v-if="items.length">
            <FilterBar v-model:filter="filter" :counts="filterCounts" />

            <ul v-if="shown.length" class="item-list">
              <ItemRow
                v-for="it in shown"
                :key="it.canonical"
                :item="it"
                :selected="isWide && it.id === detailId"
                @open="detailId = it.id"
              />
            </ul>
            <p v-else class="no-match">Nothing matches. Try another search or filter.</p>

            <FlyerLog :flyers="sortedFlyers" :can-delete="isAdmin" @delete="onDeleteFlyer" />
          </template>

          <EmptyState v-else-if="!busy && !loading" :is-admin="isAdmin" />
        </div>

        <aside v-if="isWide && items.length" class="detail-col">
          <ItemDetail
            v-if="detailItem"
            :key="detailItem.id"
            docked
            :item="detailItem"
            :is-admin="isAdmin"
            @close="detailId = null"
          />
          <div v-else class="detail-empty">
            <p class="detail-empty-title">Pick an item</p>
            <p>Its shelf check, price chart, and every price seen show up here.</p>
          </div>
        </aside>
      </template>
    </main>

    <TabBar
      v-if="!isWide"
      :active="activeTab"
      :cart-count="cartCount"
      :deal-count="dealCount"
      :is-admin="isAdmin"
      :busy="busy"
      @select="onTab"
      @scan="onScan"
      @more="settingsOpen = true"
    />

    <ItemDetail
      v-if="detailItem && !isWide"
      :item="detailItem"
      :is-admin="isAdmin"
      @close="detailId = null"
    />

    <FlyerReview
      v-if="currentReview"
      :parsed="currentReview.parsed"
      :file-name="currentReview.fileName"
      :known-canonicals="knownCanonicals"
      @save="onReviewSave"
      @discard="onReviewDiscard"
    />

    <SettingsDrawer
      :open="settingsOpen"
      :has-data="items.length > 0"
      :is-admin="isAdmin"
      :user-email="user?.email || ''"
      :has-local-backup="hasLocalBackup"
      @close="settingsOpen = false"
      @clear-all="onClearAll"
      @export="onExport"
      @import="onImport"
      @migrate="onMigrate"
      @sign-out="onSignOut"
    />
  </template>
</template>

<style scoped>
.setup {
  max-width: 460px;
  margin: 0 auto;
  padding: 80px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setup h1 {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
}

.setup p { color: var(--muted); font-size: 14px; }

.setup ol {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 20px;
  font-size: 14px;
  line-height: 1.5;
}

.setup .mono {
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 12.5px;
}

.page {
  max-width: var(--col);
  margin: 0 auto;
  padding: 8px 16px calc(var(--tabbar-h) + 40px);
}

.list-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

@media (max-width: 959px) {
  /* phones scan from the tab bar; the drop zone stays mounted for its file picker */
  .list-col > :deep(.drop) { display: none; }
}

@media (min-width: 960px) {
  .page { max-width: var(--wide); padding: 24px 24px 64px; }
  .page.split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 440px;
    gap: 28px;
    align-items: start;
  }
}

.detail-col {
  position: sticky;
  top: 92px;
}

.detail-empty {
  padding: 40px 28px;
  border: 1.5px dashed var(--hairline-strong);
  border-radius: var(--radius);
  color: var(--muted);
  font-size: 14px;
}

.detail-empty-title {
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 4px;
}

.manual {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.manual-toggle {
  align-self: flex-start;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  padding: 8px 14px;
  border-radius: 99px;
  border: 1.5px solid var(--hairline-strong);
}

.manual-toggle:hover { border-color: var(--ink); }

.status {
  font-size: 14px;
  color: var(--muted);
}

.status:not(.shown) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.status.err { color: var(--danger); }

.item-list {
  list-style: none;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: 0 0 0 1px var(--hairline);
  overflow: hidden;
}

.no-match {
  text-align: center;
  color: var(--muted);
  font-size: 14px;
  padding: 32px 0;
}
</style>
