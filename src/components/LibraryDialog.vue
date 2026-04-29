<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger
} from 'reka-ui'

import { useI18n } from '@norka/vue'

import { useLibraryStore } from '@/stores/library'
import { useLibraryUrlStore } from '@/stores/library-url'
import { useDialogUI } from '@/components/ui/dialog'
import Tip from './ui/Tip.vue'
import LibraryUrlTab from './LibraryUrlTab.vue'
import LibraryPublishTab from './LibraryPublishTab.vue'

const open = defineModel<boolean>('open', { default: false })
const cls = useDialogUI({ content: 'flex h-[64vh] w-[540px] max-w-[90vw] flex-col' })

const { dialogs } = useI18n()
const libStore = useLibraryStore()
const libUrlStore = useLibraryUrlStore()

type LibTab = 'mine' | 'url' | 'publish'
const activeTab = ref<LibTab>('mine')

// ── My Libraries tab ─────────────────────────────────────────────────────────

const fileInput = ref<HTMLInputElement | null>(null)
const adding = ref(false)
const manifests = computed(() => libStore.manifests.value ?? [])

function triggerFileInput() {
  fileInput.value?.click()
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  adding.value = true
  await libStore.addLibraryFromFile(file)
  adding.value = false
  input.value = ''
}

function removeLibrary(id: string) {
  libStore.removeLibrary(id)
  libUrlStore.removeUrlMeta(id)
}

function isUrlLibrary(id: string): boolean {
  return libUrlStore.urlLibraryIds.value.has(id)
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent :class="cls.content">
        <!-- Header -->
        <div class="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
          <DialogTitle class="text-sm font-semibold text-surface">
            {{ dialogs.designLibraries }}
          </DialogTitle>
          <DialogClose
            class="flex size-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
          >
            <icon-lucide-x class="size-4" />
          </DialogClose>
        </div>

        <!-- Tabs -->
        <TabsRoot v-model="activeTab" class="flex min-h-0 flex-1 flex-col">
          <TabsList class="flex shrink-0 gap-0 border-b border-border px-4">
            <TabsTrigger
              value="mine"
              class="border-b-2 border-transparent px-3 py-2 text-xs text-muted data-[state=active]:border-accent data-[state=active]:font-medium data-[state=active]:text-surface"
            >
              {{ dialogs.libTabMine }}
            </TabsTrigger>
            <TabsTrigger
              value="url"
              class="relative border-b-2 border-transparent px-3 py-2 text-xs text-muted data-[state=active]:border-accent data-[state=active]:font-medium data-[state=active]:text-surface"
            >
              {{ dialogs.libTabUrl }}
              <span
                v-if="libUrlStore.librariesWithUpdates.value.size > 0"
                class="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-accent"
              />
            </TabsTrigger>
            <TabsTrigger
              value="publish"
              class="border-b-2 border-transparent px-3 py-2 text-xs text-muted data-[state=active]:border-accent data-[state=active]:font-medium data-[state=active]:text-surface"
            >
              {{ dialogs.libTabPublish }}
            </TabsTrigger>
          </TabsList>

          <!-- ── My Libraries ─────────────────────────────────────────────── -->
          <TabsContent value="mine" class="flex min-h-0 flex-1 flex-col">
            <!-- Empty state -->
            <div
              v-if="manifests.length === 0"
              class="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center"
            >
              <icon-lucide-library class="size-8 text-muted" />
              <p class="text-xs text-muted">{{ dialogs.noLibrariesYet }}</p>
            </div>

            <!-- Library list -->
            <div class="min-h-0 flex-1 overflow-y-auto">
              <div
                v-for="manifest in manifests"
                :key="manifest.id"
                class="group flex items-center gap-3 border-b border-border/30 px-4 py-3 hover:bg-hover/40"
              >
                <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div class="flex items-center gap-1.5">
                    <span class="truncate text-xs font-medium text-surface">
                      {{ manifest.name }}
                    </span>
                    <!-- URL-sourced badge -->
                    <span
                      v-if="isUrlLibrary(manifest.id)"
                      class="shrink-0 rounded bg-hover px-1.5 py-0.5 text-[9px] text-muted"
                    >
                      <icon-lucide-link class="inline size-2.5" />
                      URL
                    </span>
                    <!-- Update available badge -->
                    <span
                      v-if="libUrlStore.librariesWithUpdates.value.has(manifest.id)"
                      class="shrink-0 cursor-pointer rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent hover:bg-accent/25"
                      @click="activeTab = 'url'"
                    >
                      ↑ {{ dialogs.libUpdateAvailable }}
                    </span>
                  </div>
                  <div class="flex gap-3 text-[10px] text-muted">
                    <span
                      >{{ manifest.componentCount }}
                      {{ dialogs.libraryComponents.toLowerCase() }}</span
                    >
                    <span
                      >{{ manifest.variableCount }}
                      {{ dialogs.libraryVariables.toLowerCase() }}</span
                    >
                    <span>{{ manifest.styleCount }} {{ dialogs.libraryStyles.toLowerCase() }}</span>
                  </div>
                </div>

                <Tip :label="dialogs.removeLibrary">
                  <button
                    class="flex size-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-transparent hover:bg-hover hover:text-error group-hover:text-muted"
                    @click="removeLibrary(manifest.id)"
                  >
                    <icon-lucide-trash-2 class="size-3.5" />
                  </button>
                </Tip>
              </div>
            </div>

            <!-- Error -->
            <div
              v-if="libStore.error.value"
              class="shrink-0 border-t border-error/30 bg-error/10 px-4 py-2 text-xs text-error"
            >
              {{ libStore.error.value }}
            </div>

            <!-- Add from file button -->
            <button
              class="flex w-full shrink-0 cursor-pointer items-center gap-1.5 border-t border-border bg-transparent px-4 py-2.5 text-xs text-muted hover:bg-hover hover:text-surface disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="adding"
              @click="triggerFileInput()"
            >
              <icon-lucide-loader-2 v-if="adding" class="size-3.5 animate-spin" />
              <icon-lucide-folder-open v-else class="size-3.5" />
              {{ dialogs.addLibrary }}
            </button>

            <input
              ref="fileInput"
              type="file"
              accept=".fig,.pen"
              class="hidden"
              @change="onFileSelected"
            />
          </TabsContent>

          <!-- ── Add by URL ───────────────────────────────────────────────── -->
          <TabsContent value="url" class="flex min-h-0 flex-1 flex-col">
            <LibraryUrlTab />
          </TabsContent>

          <!-- ── Publish ──────────────────────────────────────────────────── -->
          <TabsContent value="publish" class="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <LibraryPublishTab />
          </TabsContent>
        </TabsRoot>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
