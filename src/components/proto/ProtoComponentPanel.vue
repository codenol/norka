<script setup lang="ts">
import { ref, computed } from 'vue'
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui'

import { PRIME_PREVIEW_DEFS } from '@/composables/use-primereact-preview'
import ComponentPreviewItem from '@/components/ComponentPreviewItem.vue'
import { useProtoStore } from '@/composables/use-proto-store'
import type { PrimePreviewDef } from '@/composables/use-primereact-preview'

const props = withDefaults(defineProps<{ embedded?: boolean }>(), {
  embedded: false,
})

const store = useProtoStore()

const searchQuery = ref('')

const filteredDefs = computed<PrimePreviewDef[]>(() => {
  const q = searchQuery.value.toLowerCase().trim()
  const defs = !q
    ? PRIME_PREVIEW_DEFS
    : PRIME_PREVIEW_DEFS.filter((d) =>
        d.name.toLowerCase().includes(q) || d.exportName.toLowerCase().includes(q),
      )

  return [...defs].sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
})

function handleInsert(def: PrimePreviewDef) {
  store.addNode(def)
}

function handleDragStart(def: PrimePreviewDef, event: DragEvent) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/x-norka-proto-component', JSON.stringify({
    componentName: def.name,
  }))
}
</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col bg-panel/80"
    :class="props.embedded ? 'w-full' : 'w-56 shrink-0 border-r border-border/60'"
    style="contain: paint layout style"
  >
    <!-- Search -->
    <div class="shrink-0 border-b border-border/60 px-2 py-1.5">
      <div class="flex items-center gap-1.5 rounded border border-border bg-canvas px-2 py-1">
        <icon-lucide-search class="size-3 shrink-0 text-muted" />
        <input
          v-model="searchQuery"
          placeholder="Поиск..."
          class="min-w-0 flex-1 border-none bg-transparent text-[11px] text-surface outline-none placeholder:text-muted"
        />
        <button
          v-if="searchQuery"
          class="text-muted hover:text-surface"
          @click="searchQuery = ''"
        >
          <icon-lucide-x class="size-3" />
        </button>
      </div>
    </div>

    <!-- Component grid -->
    <div class="flex-1 overflow-y-auto py-1">
      <div
        v-if="filteredDefs.length === 0"
        class="flex items-center justify-center py-8"
      >
        <p class="text-[11px] text-muted">Ничего не найдено</p>
      </div>

      <TooltipProvider :delay-duration="600" :skip-delay-duration="100">
        <div class="grid grid-cols-2 gap-2 px-2.5 py-1.5">
          <TooltipRoot v-for="def in filteredDefs" :key="def.name">
            <TooltipTrigger as-child>
              <ComponentPreviewItem
                :archetype-name="def.name"
                :module-path="def.importPath"
                :export-name="def.exportName"
                :preview-props="def.previewProps"
                :is-container="def.acceptsChildren === true"
                :is-disabled="false"
                @insert="handleInsert(def)"
                @drag-start="handleDragStart(def, $event)"
              />
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                side="right"
                :side-offset="6"
                class="z-50 max-w-44 rounded-md border border-border bg-panel px-2.5 py-1.5 text-[11px] text-surface shadow-md"
              >
                <p class="font-medium">{{ def.name }}</p>
                <p class="mt-0.5 text-muted">{{ def.importPath }}</p>
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>
        </div>
      </TooltipProvider>
    </div>

    <div class="shrink-0 border-t border-border/60 px-3 py-2">
      <p class="text-[10px] text-muted">Нажмите, чтобы добавить</p>
    </div>
  </div>
</template>
