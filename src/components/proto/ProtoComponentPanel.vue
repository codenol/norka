<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'

import {
  BUILT_IN_ARCHETYPES,
  ARCHETYPE_CATEGORIES,
  buildAliasMap,
  matchArchetype
} from '@norka/core'
import { PRIME_PREVIEW_DEFS } from '@/composables/use-primereact-preview'
import ComponentPreviewItem from '@/components/ComponentPreviewItem.vue'
import { useProtoStore } from '@/composables/use-proto-store'
import type { PrimePreviewDef } from '@/composables/use-primereact-preview'
import type { ArchetypeCategory, ComponentArchetype } from '@norka/core'

const props = withDefaults(defineProps<{ embedded?: boolean }>(), {
  embedded: false
})

const store = useProtoStore()

const searchQuery = ref('')
const activeCategory = ref<ArchetypeCategory | null>(null)
const aliasMap = buildAliasMap(BUILT_IN_ARCHETYPES)

const archetypeToPreviewDef = computed<Map<string, PrimePreviewDef>>(() => {
  const map = new Map<string, PrimePreviewDef>()
  for (const def of PRIME_PREVIEW_DEFS) {
    const archetypeId = matchArchetype(def.name, aliasMap)
    if (archetypeId && !map.has(archetypeId)) map.set(archetypeId, def)
  }
  return map
})

const filteredArchetypes = computed<ComponentArchetype[]>(() => {
  const q = searchQuery.value.toLowerCase().trim()
  return BUILT_IN_ARCHETYPES.filter((a) => {
    const byCategory = !activeCategory.value || a.category === activeCategory.value
    const bySearch =
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.aliases.some((alias) => alias.toLowerCase().includes(q))
    return byCategory && bySearch
  }).sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
})

function handleInsert(archetype: ComponentArchetype) {
  const mapped = archetypeToPreviewDef.value.get(archetype.id)
  if (!mapped) return
  store.addNode(mapped)
}

function handleDragStart(archetype: ComponentArchetype, event: DragEvent) {
  const mapped = archetypeToPreviewDef.value.get(archetype.id)
  if (!mapped) return
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(
    'application/x-norka-proto-component',
    JSON.stringify({
      componentName: mapped.name
    })
  )
}

function archetypeStateHints(archetypeId: string): string[] {
  const def = archetypeToPreviewDef.value.get(archetypeId)
  return Object.keys(def?.statePresets ?? {})
}

function toggleCategory(category: ArchetypeCategory) {
  activeCategory.value = activeCategory.value === category ? null : category
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
        <button v-if="searchQuery" class="text-muted hover:text-surface" @click="searchQuery = ''">
          <icon-lucide-x class="size-3" />
        </button>
      </div>
    </div>

    <div class="flex shrink-0 flex-wrap gap-1 border-b border-border/60 px-2 py-1.5">
      <button
        v-for="category in ARCHETYPE_CATEGORIES"
        :key="category"
        class="rounded-full px-1.5 py-0.5 text-[10px] transition-colors"
        :class="
          activeCategory === category
            ? 'bg-accent/20 text-accent'
            : 'bg-hover/60 text-muted hover:text-surface'
        "
        @click="toggleCategory(category)"
      >
        {{ category }}
      </button>
    </div>

    <!-- Component grid -->
    <div class="flex-1 overflow-y-auto py-1">
      <div v-if="filteredArchetypes.length === 0" class="flex items-center justify-center py-8">
        <p class="text-[11px] text-muted">Ничего не найдено</p>
      </div>

      <TooltipProvider :delay-duration="600" :skip-delay-duration="100">
        <div class="grid grid-cols-2 gap-2 px-2.5 py-1.5">
          <TooltipRoot v-for="archetype in filteredArchetypes" :key="archetype.id">
            <TooltipTrigger as-child>
              <template v-if="archetypeToPreviewDef.get(archetype.id)">
                <ComponentPreviewItem
                  :archetype-name="archetype.name"
                  :module-path="archetypeToPreviewDef.get(archetype.id)!.importPath"
                  :export-name="archetypeToPreviewDef.get(archetype.id)!.exportName"
                  :preview-props="archetypeToPreviewDef.get(archetype.id)!.previewProps"
                  :is-container="archetypeToPreviewDef.get(archetype.id)!.acceptsChildren === true"
                  :is-disabled="false"
                  @insert="handleInsert(archetype)"
                  @drag-start="handleDragStart(archetype, $event)"
                />
              </template>
              <button
                v-else
                class="flex w-full flex-col items-center justify-center gap-1.5 rounded border border-border/40 bg-canvas/40 px-2 py-2 text-[10px] text-muted opacity-60"
                disabled
              >
                <icon-lucide-component class="size-4" />
                <span class="line-clamp-2">{{ archetype.name }}</span>
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                side="right"
                :side-offset="6"
                class="z-50 max-w-44 rounded-md border border-border bg-panel px-2.5 py-1.5 text-[11px] text-surface shadow-md"
              >
                <p class="font-medium">{{ archetype.name }}</p>
                <p class="mt-0.5 text-muted">{{ archetype.description }}</p>
                <p v-if="archetypeToPreviewDef.get(archetype.id)" class="mt-1 text-muted/80">
                  {{ archetypeToPreviewDef.get(archetype.id)!.name }}
                </p>
                <p v-else class="mt-1 text-[10px] text-muted/60">Нет Prime маппинга</p>
                <p v-if="archetypeStateHints(archetype.id).length" class="mt-1 text-[10px] text-accent">
                  states: {{ archetypeStateHints(archetype.id).join(', ') }}
                </p>
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
