<script setup lang="ts">
import { ref, computed } from 'vue'
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

import { useI18n } from '@beresta/vue'
import { libraryRegistry, colorToCSS } from '@beresta/core'

import { useEditorStore } from '@/stores/editor'
import { useLibraryStore } from '@/stores/library'
import { useDialogUI } from '@/components/ui/dialog'
import Tip from './ui/Tip.vue'

import type { FillStyle, NamedStyle } from '@beresta/core'

type LibTab = 'COMPONENTS' | 'VARIABLES' | 'STYLES'

const open = defineModel<boolean>('open', { default: false })
const cls = useDialogUI({ content: 'flex h-[70vh] w-[600px] max-w-[90vw] flex-col' })

const { dialogs } = useI18n()
const editor = useEditorStore()
const libraryStore = useLibraryStore()

const activeTab = ref<LibTab>('COMPONENTS')
const searchTerm = ref('')

// ── Helpers ───────────────────────────────────────────────────────────────────

function libraryName(libraryId: string): string {
  return libraryRegistry.getAll().find((m) => m.id === libraryId)?.name ?? libraryId
}

function groupByLibrary<T extends { libraryId: string }>(
  items: T[]
): Array<{ libraryName: string; items: T[] }> {
  const map = new Map<string, { libraryName: string; items: T[] }>()
  for (const item of items) {
    let group = map.get(item.libraryId)
    if (!group) {
      group = { libraryName: libraryName(item.libraryId), items: [] }
      map.set(item.libraryId, group)
    }
    group.items.push(item)
  }
  return [...map.values()]
}

// ── Components ────────────────────────────────────────────────────────────────

const allComponents = computed(() =>
  libraryRegistry.getComponents()
)

const filteredComponents = computed(() => {
  const q = searchTerm.value.toLowerCase()
  return allComponents.value.filter(
    ({ node }) => !q || node.name.toLowerCase().includes(q)
  )
})

const componentsByLibrary = computed(() => groupByLibrary(filteredComponents.value))

function insertComponent(libraryId: string, componentId: string) {
  const instanceId = libraryStore.insertComponent(
    libraryId,
    componentId,
    editor.graph,
    editor.state.currentPageId
  )
  if (instanceId) {
    editor.state.selectedIds = new Set([instanceId])
    open.value = false
  }
}

// ── Variables ─────────────────────────────────────────────────────────────────

const allCollections = computed(() => libraryRegistry.getCollections())

const filteredCollections = computed(() => {
  const q = searchTerm.value.toLowerCase()
  return allCollections.value.filter(
    ({ collection }) => !q || collection.name.toLowerCase().includes(q)
  )
})

const collectionsByLibrary = computed(() => groupByLibrary(filteredCollections.value))

function addCollectionToLocal(libraryId: string, collectionId: string) {
  libraryStore.importCollectionToDoc(libraryId, collectionId, editor.graph)
}

// ── Styles ────────────────────────────────────────────────────────────────────

const allStyles = computed(() => libraryRegistry.getStyles())

const filteredStyles = computed(() => {
  const q = searchTerm.value.toLowerCase()
  return allStyles.value.filter(
    ({ style }) => !q || style.name.toLowerCase().includes(q)
  )
})

const stylesByLibrary = computed(() => groupByLibrary(filteredStyles.value))

function getFillColor(style: NamedStyle): string {
  const fill = style as FillStyle
  if (!fill.fills?.length) return 'transparent'
  const f = fill.fills[0]
  if (!f?.color) return 'transparent'
  return colorToCSS(f.color)
}

function addStyleToLocal(libraryId: string, styleId: string) {
  libraryStore.importStyleToDoc(libraryId, styleId, editor.graph)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function onTabChange(tab: string) {
  searchTerm.value = ''
  activeTab.value = tab as LibTab
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent :class="cls.content">
        <TabsRoot :model-value="activeTab" class="flex flex-1 flex-col overflow-hidden" @update:model-value="onTabChange">
          <!-- Header -->
          <div class="flex shrink-0 items-center border-b border-border">
            <TabsList class="flex gap-0.5 px-3 py-1">
              <TabsTrigger
                value="COMPONENTS"
                class="cursor-pointer rounded border-none px-2.5 py-1 text-xs text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
              >
                {{ dialogs.libraryComponents }}
              </TabsTrigger>
              <TabsTrigger
                value="VARIABLES"
                class="cursor-pointer rounded border-none px-2.5 py-1 text-xs text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
              >
                {{ dialogs.libraryVariables }}
              </TabsTrigger>
              <TabsTrigger
                value="STYLES"
                class="cursor-pointer rounded border-none px-2.5 py-1 text-xs text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
              >
                {{ dialogs.libraryStyles }}
              </TabsTrigger>
            </TabsList>

            <div class="ml-auto flex items-center gap-1.5 px-3">
              <div class="flex items-center gap-1 rounded border border-border px-2 py-0.5">
                <icon-lucide-search class="size-3 text-muted" />
                <input
                  v-model="searchTerm"
                  class="w-24 border-none bg-transparent text-xs text-surface outline-none placeholder:text-muted"
                  :placeholder="dialogs.search"
                />
              </div>
              <DialogTitle class="sr-only">{{ dialogs.designLibraries }}</DialogTitle>
              <DialogClose
                class="flex size-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
              >
                <icon-lucide-x class="size-4" />
              </DialogClose>
            </div>
          </div>

          <!-- ── Components tab ─────────────────────────────────────────────── -->
          <TabsContent value="COMPONENTS" class="flex flex-1 flex-col overflow-hidden outline-none">
            <div v-if="componentsByLibrary.length === 0" class="flex flex-1 items-center justify-center">
              <p class="text-xs text-muted">{{ dialogs.noLibraryComponents }}</p>
            </div>
            <div v-else class="flex-1 overflow-y-auto">
              <template v-for="group in componentsByLibrary" :key="group.libraryName">
                <!-- Library group header -->
                <div class="sticky top-0 border-b border-border/50 bg-surface px-4 py-1.5">
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {{ group.libraryName }}
                  </span>
                </div>
                <!-- Component rows -->
                <button
                  v-for="{ libraryId, node } in group.items"
                  :key="node.id"
                  class="flex w-full cursor-pointer items-center gap-2 border-b border-border/30 bg-transparent px-4 py-2 text-left hover:bg-hover/60"
                  @click="insertComponent(libraryId, node.id)"
                >
                  <icon-lucide-component
                    v-if="node.type === 'COMPONENT'"
                    class="size-3.5 shrink-0 text-component"
                  />
                  <icon-lucide-layers
                    v-else
                    class="size-3.5 shrink-0 text-component"
                  />
                  <span class="flex-1 truncate text-xs text-surface">{{ node.name }}</span>
                  <Tip :label="dialogs.insertComponent">
                    <icon-lucide-plus class="size-3.5 text-muted" />
                  </Tip>
                </button>
              </template>
            </div>
          </TabsContent>

          <!-- ── Variables tab ──────────────────────────────────────────────── -->
          <TabsContent value="VARIABLES" class="flex flex-1 flex-col overflow-hidden outline-none">
            <div v-if="collectionsByLibrary.length === 0" class="flex flex-1 items-center justify-center">
              <p class="text-xs text-muted">{{ dialogs.noLibraryVariables }}</p>
            </div>
            <div v-else class="flex-1 overflow-y-auto">
              <template v-for="group in collectionsByLibrary" :key="group.libraryName">
                <!-- Library group header -->
                <div class="sticky top-0 border-b border-border/50 bg-surface px-4 py-1.5">
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {{ group.libraryName }}
                  </span>
                </div>
                <!-- Collection rows -->
                <div
                  v-for="{ libraryId, collection } in group.items"
                  :key="collection.id"
                  class="group flex items-center gap-2 border-b border-border/30 px-4 py-2 hover:bg-hover/60"
                >
                  <icon-lucide-folder class="size-3.5 shrink-0 text-muted" />
                  <div class="flex flex-1 flex-col gap-0.5">
                    <span class="text-xs text-surface">{{ collection.name }}</span>
                    <span class="text-[10px] text-muted">{{ collection.variableIds.length }} variables</span>
                  </div>
                  <Tip :label="dialogs.addToLocal">
                    <button
                      class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-transparent hover:bg-hover hover:text-surface group-hover:text-muted"
                      @click="addCollectionToLocal(libraryId, collection.id)"
                    >
                      <icon-lucide-download class="size-3.5" />
                    </button>
                  </Tip>
                </div>
              </template>
            </div>
          </TabsContent>

          <!-- ── Styles tab ─────────────────────────────────────────────────── -->
          <TabsContent value="STYLES" class="flex flex-1 flex-col overflow-hidden outline-none">
            <div v-if="stylesByLibrary.length === 0" class="flex flex-1 items-center justify-center">
              <p class="text-xs text-muted">{{ dialogs.noLibraryStyles }}</p>
            </div>
            <div v-else class="flex-1 overflow-y-auto">
              <template v-for="group in stylesByLibrary" :key="group.libraryName">
                <!-- Library group header -->
                <div class="sticky top-0 border-b border-border/50 bg-surface px-4 py-1.5">
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {{ group.libraryName }}
                  </span>
                </div>
                <!-- Style rows -->
                <div
                  v-for="{ libraryId, style } in group.items"
                  :key="style.id"
                  class="group flex items-center gap-2 border-b border-border/30 px-4 py-2 hover:bg-hover/60"
                >
                  <!-- Preview -->
                  <div
                    v-if="style.type === 'FILL'"
                    class="size-5 shrink-0 rounded border border-border"
                    :style="{ background: getFillColor(style) }"
                  />
                  <icon-lucide-type v-else-if="style.type === 'TEXT'" class="size-4 shrink-0 text-muted" />
                  <icon-lucide-sparkles v-else class="size-4 shrink-0 text-muted" />

                  <span class="flex-1 truncate text-xs text-surface">{{ style.name }}</span>

                  <Tip :label="dialogs.addToLocal">
                    <button
                      class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-transparent hover:bg-hover hover:text-surface group-hover:text-muted"
                      @click="addStyleToLocal(libraryId, style.id)"
                    >
                      <icon-lucide-download class="size-3.5" />
                    </button>
                  </Tip>
                </div>
              </template>
            </div>
          </TabsContent>
        </TabsRoot>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
