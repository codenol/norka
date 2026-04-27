<script setup lang="ts">
import { ref, computed } from 'vue'

import { useI18n } from '@norka/vue'

import { useLibraryStore } from '@/stores/library'
import { useLibraryGitHubStore } from '@/stores/library-github'

const libStore = useLibraryStore()
const gh = useLibraryGitHubStore()
const { dialogs } = useI18n()

// ── GitHub connect ────────────────────────────────────────────────────────────

const tokenInput = ref('')
const showToken = ref(false)
const repoInput = ref('norka-libraries')
const editingConfig = ref(false)

function startEditConfig() {
  editingConfig.value = true
  tokenInput.value = ''
}

function cancelEditConfig() {
  editingConfig.value = false
  tokenInput.value = ''
}

async function handleConnect() {
  const token = tokenInput.value.trim()
  if (!token) return
  await gh.connectGitHub(token, repoInput.value.trim() || 'norka-libraries')
  if (!gh.error.value) {
    editingConfig.value = false
    tokenInput.value = ''
  }
}

function handleDisconnect() {
  gh.disconnectGitHub()
}

// ── Publish ──────────────────────────────────────────────────────────────────

const selectedLibraryId = ref<string | null>(null)
const copiedUrl = ref(false)

const selectedLibrary = computed(() =>
  libStore.manifests.value.find((m) => m.id === selectedLibraryId.value) ?? null
)

// Auto-select first library if none selected
if (libStore.manifests.value.length > 0 && !selectedLibraryId.value) {
  selectedLibraryId.value = libStore.manifests.value[0]?.id ?? null
}

async function handlePublish() {
  const lib = selectedLibrary.value
  if (!lib) return
  const buf = await libStore.exportLibraryBuffer(lib.id)
  if (!buf) {
    console.error('[LibraryPublishTab] Failed to export buffer for', lib.id)
    return
  }
  await gh.publishLibrary(lib.id, lib.name, buf.buffer as ArrayBuffer)
}

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    copiedUrl.value = true
    setTimeout(() => { copiedUrl.value = false }, 1800)
  } catch (err) {
    console.warn('[LibraryPublishTab] Clipboard write failed:', err)
  }
}

const publishedUrl = computed(() =>
  selectedLibraryId.value ? gh.getPublishedUrl(selectedLibraryId.value) : null
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-0">

    <!-- GitHub connection section -->
    <div class="shrink-0 border-b border-border px-4 py-3">
      <p class="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted">
        {{ dialogs.libPublishHosting }}
      </p>

      <!-- Not connected -->
      <div v-if="!gh.config.value || editingConfig" class="flex flex-col gap-2">
        <div class="flex items-center gap-1.5">
          <icon-lucide-github class="size-4 shrink-0 text-muted" />
          <span class="text-xs text-surface">GitHub</span>
        </div>

        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-1.5">
            <input
              v-model="tokenInput"
              :type="showToken ? 'text' : 'password'"
              :placeholder="dialogs.libPublishTokenPlaceholder"
              class="min-w-0 flex-1 rounded border border-border bg-panel px-2 py-1.5 font-mono text-xs text-surface placeholder-muted outline-none focus:border-accent"
              @keydown.enter="handleConnect"
            />
            <button
              class="shrink-0 rounded p-1 text-muted hover:text-surface"
              @click="showToken = !showToken"
            >
              <icon-lucide-eye-off v-if="showToken" class="size-3.5" />
              <icon-lucide-eye v-else class="size-3.5" />
            </button>
          </div>
          <input
            v-model="repoInput"
            type="text"
            :placeholder="dialogs.libPublishRepoPlaceholder"
            class="rounded border border-border bg-panel px-2 py-1.5 text-xs text-surface placeholder-muted outline-none focus:border-accent"
          />
          <p class="text-[10px] text-muted">{{ dialogs.libPublishTokenHint }}</p>
        </div>

        <div class="flex gap-1.5">
          <button
            :disabled="!tokenInput.trim() || gh.connecting.value"
            class="flex items-center gap-1 rounded bg-surface px-3 py-1.5 text-xs font-medium text-panel disabled:opacity-50"
            @click="handleConnect"
          >
            <icon-lucide-loader-2 v-if="gh.connecting.value" class="size-3 animate-spin" />
            {{ gh.connecting.value ? dialogs.libPublishConnecting : dialogs.libPublishConnect }}
          </button>
          <button
            v-if="editingConfig"
            class="rounded px-3 py-1.5 text-xs text-muted hover:text-surface"
            @click="cancelEditConfig"
          >
            {{ dialogs.cancel }}
          </button>
        </div>

        <p v-if="gh.error.value" class="text-[10px] text-error">{{ gh.error.value }}</p>

        <a
          href="https://github.com/settings/tokens/new?scopes=repo&description=Bereста+libraries"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-1 text-[10px] text-accent hover:underline"
        >
          <icon-lucide-external-link class="size-3" />
          {{ dialogs.libPublishGetToken }}
        </a>
      </div>

      <!-- Connected -->
      <div v-else class="flex items-center gap-2">
        <icon-lucide-github class="size-4 shrink-0 text-surface" />
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-surface">{{ gh.config.value.owner }}</p>
          <p class="text-[10px] text-muted">{{ gh.config.value.repo }}</p>
        </div>
        <button
          class="shrink-0 rounded px-2 py-1 text-[10px] text-muted hover:bg-hover hover:text-surface"
          @click="startEditConfig"
        >
          {{ dialogs.libPublishChange }}
        </button>
        <button
          class="shrink-0 rounded px-2 py-1 text-[10px] text-error hover:bg-error/10"
          @click="handleDisconnect"
        >
          {{ dialogs.libPublishDisconnect }}
        </button>
      </div>
    </div>

    <!-- Library selector + publish -->
    <div class="flex min-h-0 flex-1 flex-col px-4 py-3">
      <p class="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted">
        {{ dialogs.libPublishSelectLibrary }}
      </p>

      <!-- No libraries -->
      <div
        v-if="libStore.manifests.value.length === 0"
        class="flex flex-1 flex-col items-center justify-center gap-2 text-center"
      >
        <icon-lucide-library class="size-7 text-muted" />
        <p class="text-xs text-muted">{{ dialogs.noLibrariesYet }}</p>
      </div>

      <template v-else>
        <!-- Library list (radio-style selection) -->
        <ul class="flex flex-col gap-0.5">
          <li
            v-for="manifest in libStore.manifests.value"
            :key="manifest.id"
            class="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-hover/60"
            :class="selectedLibraryId === manifest.id ? 'bg-accent/10' : ''"
            @click="selectedLibraryId = manifest.id"
          >
            <div
              class="size-3 shrink-0 rounded-full border"
              :class="selectedLibraryId === manifest.id
                ? 'border-accent bg-accent'
                : 'border-muted bg-transparent'"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-medium text-surface">{{ manifest.name }}</p>
              <p class="text-[10px] text-muted">
                {{ manifest.componentCount }} {{ dialogs.libraryComponents.toLowerCase() }}
              </p>
            </div>
          </li>
        </ul>

        <!-- Publish button -->
        <div class="mt-3 flex flex-col gap-2">
          <button
            :disabled="!selectedLibrary || !gh.config.value || gh.publishing.value"
            class="flex items-center justify-center gap-1.5 rounded bg-accent py-2 text-xs font-medium text-white disabled:opacity-40"
            @click="handlePublish"
          >
            <icon-lucide-loader-2 v-if="gh.publishing.value" class="size-3.5 animate-spin" />
            <icon-lucide-upload-cloud v-else class="size-3.5" />
            {{ gh.publishing.value ? dialogs.libPublishing : dialogs.libPublish }}
          </button>

          <p v-if="gh.error.value" class="text-[10px] text-error">{{ gh.error.value }}</p>

          <!-- Published URL -->
          <div
            v-if="publishedUrl"
            class="flex items-center gap-1.5 rounded border border-border bg-hover/40 px-2.5 py-2"
          >
            <icon-lucide-link class="size-3 shrink-0 text-muted" />
            <p class="min-w-0 flex-1 truncate font-mono text-[10px] text-muted">
              {{ publishedUrl }}
            </p>
            <button
              class="shrink-0 rounded px-2 py-0.5 text-[10px] text-accent hover:bg-accent/10"
              @click="copyUrl(publishedUrl)"
            >
              <span v-if="copiedUrl">✓</span>
              <span v-else>{{ dialogs.libPublishCopyUrl }}</span>
            </button>
          </div>
          <p v-if="publishedUrl" class="text-[10px] text-muted">
            {{ dialogs.libPublishShareHint }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
