<script setup lang="ts">
import { ref } from 'vue'

import { useI18n } from '@norka/vue'

import { useLibraryUrlStore, previewUrl } from '@/stores/library-url'
import { useLibraryStore } from '@/stores/library'

const libUrlStore = useLibraryUrlStore()
const libStore = useLibraryStore()
const { dialogs } = useI18n()

// ── Add by URL ───────────────────────────────────────────────────────────────

interface Preview {
  name: string
  componentCount: number
  variableCount: number
  styleCount: number
}

const urlInput = ref('')
const previewing = ref(false)
const preview = ref<Preview | null>(null)
const previewError = ref<string | null>(null)
const adding = ref(false)

async function handlePreview() {
  const url = urlInput.value.trim()
  if (!url) return
  previewing.value = true
  previewError.value = null
  preview.value = null
  try {
    preview.value = await previewUrl(url)
  } catch (err) {
    previewError.value = err instanceof Error ? err.message : String(err)
    console.warn('[LibraryUrlTab] Preview failed:', err)
  } finally {
    previewing.value = false
  }
}

async function handleAdd() {
  const url = urlInput.value.trim()
  if (!url) return
  adding.value = true
  await libUrlStore.addLibraryFromUrl(url, preview.value?.name)
  adding.value = false
  if (!libUrlStore.fetchError.value) {
    urlInput.value = ''
    preview.value = null
  }
}

function clearPreview() {
  preview.value = null
  previewError.value = null
  urlInput.value = ''
}

// ── Update checks ────────────────────────────────────────────────────────────

async function handleCheckUpdates() {
  await libUrlStore.checkAllUpdates()
}

// ── Update: apply / dismiss ──────────────────────────────────────────────────

async function handleApplyUpdate(libraryId: string) {
  await libUrlStore.applyUpdate(libraryId)
}

function handleDismiss(libraryId: string) {
  libUrlStore.dismissUpdate(libraryId)
}

// ── Remove URL subscription ──────────────────────────────────────────────────

function handleRemove(libraryId: string) {
  libUrlStore.removeUrlMeta(libraryId)
  libStore.removeLibrary(libraryId)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-0">

    <!-- URL input row -->
    <div class="flex shrink-0 items-start gap-1.5 border-b border-border px-4 py-3">
      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <input
          v-model="urlInput"
          type="url"
          :placeholder="dialogs.libUrlPlaceholder"
          class="w-full rounded border border-border bg-panel px-2.5 py-1.5 text-xs text-surface placeholder-muted outline-none focus:border-accent"
          @keydown.enter="handlePreview"
        />

        <!-- Preview card -->
        <div
          v-if="preview"
          class="flex items-center gap-2 rounded border border-border/60 bg-hover/40 px-2.5 py-2"
        >
          <icon-lucide-library class="size-4 shrink-0 text-muted" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-medium text-surface">{{ preview.name }}</p>
            <p class="text-[10px] text-muted">
              {{ preview.componentCount }} {{ dialogs.libraryComponents.toLowerCase() }} ·
              {{ preview.variableCount }} {{ dialogs.libraryVariables.toLowerCase() }} ·
              {{ preview.styleCount }} {{ dialogs.libraryStyles.toLowerCase() }}
            </p>
          </div>
          <button class="text-muted hover:text-surface" @click="clearPreview">
            <icon-lucide-x class="size-3" />
          </button>
        </div>

        <!-- Preview error -->
        <p v-if="previewError" class="text-[10px] text-error">{{ previewError }}</p>

        <!-- Fetch error -->
        <p v-if="libUrlStore.fetchError.value" class="text-[10px] text-error">
          {{ libUrlStore.fetchError.value }}
        </p>
      </div>

      <div class="flex shrink-0 flex-col gap-1">
        <button
          v-if="!preview"
          :disabled="!urlInput.trim() || previewing"
          class="flex items-center gap-1 rounded bg-hover px-2.5 py-1.5 text-xs text-surface disabled:opacity-50 hover:bg-hover/80"
          @click="handlePreview"
        >
          <icon-lucide-loader-2 v-if="previewing" class="size-3 animate-spin" />
          <icon-lucide-search v-else class="size-3" />
          {{ dialogs.libUrlCheck }}
        </button>
        <button
          v-else
          :disabled="adding"
          class="flex items-center gap-1 rounded bg-accent px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          @click="handleAdd"
        >
          <icon-lucide-loader-2 v-if="adding" class="size-3 animate-spin" />
          <icon-lucide-plus v-else class="size-3" />
          {{ dialogs.libUrlAdd }}
        </button>
      </div>
    </div>

    <!-- Subscribed libraries list -->
    <div class="min-h-0 flex-1 overflow-y-auto">
      <!-- Empty state -->
      <div
        v-if="libUrlStore.metas.value.length === 0"
        class="flex flex-col items-center justify-center gap-2 py-12 text-center"
      >
        <icon-lucide-link class="size-7 text-muted" />
        <p class="text-xs text-muted">{{ dialogs.libUrlEmpty }}</p>
      </div>

      <!-- Library rows -->
      <div
        v-for="meta in libUrlStore.metas.value"
        :key="meta.libraryId"
        class="border-b border-border/30"
      >
        <!-- Main row -->
        <div class="group flex items-center gap-3 px-4 py-3 hover:bg-hover/30">
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <div class="flex items-center gap-1.5">
              <span class="truncate text-xs font-medium text-surface">
                {{ libStore.manifests.value.find(m => m.id === meta.libraryId)?.name ?? meta.url }}
              </span>
              <!-- Update badge -->
              <span
                v-if="libUrlStore.librariesWithUpdates.value.has(meta.libraryId)"
                class="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent"
              >
                {{ dialogs.libUpdateAvailable }}
              </span>
            </div>
            <p class="truncate text-[10px] text-muted">{{ meta.url }}</p>
          </div>

          <!-- Actions -->
          <button
            class="shrink-0 rounded p-1 text-transparent hover:bg-hover hover:text-surface group-hover:text-muted"
            :title="dialogs.removeLibrary"
            @click="handleRemove(meta.libraryId)"
          >
            <icon-lucide-trash-2 class="size-3.5" />
          </button>
        </div>

        <!-- Update panel (inline expansion) -->
        <div
          v-if="libUrlStore.librariesWithUpdates.value.has(meta.libraryId)"
          class="border-t border-accent/20 bg-accent/5 px-4 py-2.5"
        >
          <div v-if="libUrlStore.getUpdateInfo(meta.libraryId) as info">
            <div class="mb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
              <span
                v-if="(libUrlStore.getUpdateInfo(meta.libraryId)?.addedComponents.length ?? 0) > 0"
                class="text-success"
              >
                +{{ libUrlStore.getUpdateInfo(meta.libraryId)?.addedComponents.length }}
                {{ dialogs.libDiffAdded }}
              </span>
              <span
                v-if="(libUrlStore.getUpdateInfo(meta.libraryId)?.removedComponents.length ?? 0) > 0"
                class="text-error"
              >
                −{{ libUrlStore.getUpdateInfo(meta.libraryId)?.removedComponents.length }}
                {{ dialogs.libDiffRemoved }}
              </span>
              <span class="text-muted">
                {{ libUrlStore.getUpdateInfo(meta.libraryId)?.totalComponents }}
                {{ dialogs.libraryComponents.toLowerCase() }}
              </span>
            </div>
            <div class="flex gap-1.5">
              <button
                class="rounded bg-accent px-2.5 py-1 text-[10px] font-medium text-white"
                @click="handleApplyUpdate(meta.libraryId)"
              >
                {{ dialogs.libUpdateAll }}
              </button>
              <button
                class="rounded px-2.5 py-1 text-[10px] text-muted hover:text-surface"
                @click="handleDismiss(meta.libraryId)"
              >
                {{ dialogs.libUpdateDismiss }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer: check for updates -->
    <button
      class="flex w-full shrink-0 items-center justify-center gap-1.5 border-t border-border px-4 py-2 text-xs text-muted hover:bg-hover hover:text-surface disabled:opacity-50"
      :disabled="libUrlStore.checking.value"
      @click="handleCheckUpdates"
    >
      <icon-lucide-loader-2 v-if="libUrlStore.checking.value" class="size-3.5 animate-spin" />
      <icon-lucide-refresh-cw v-else class="size-3.5" />
      {{ libUrlStore.checking.value ? dialogs.libChecking : dialogs.libCheckUpdates }}
    </button>
  </div>
</template>
