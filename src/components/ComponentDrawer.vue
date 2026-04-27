<script setup lang="ts">
import { computed, ref } from 'vue'
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui'

import {
  BUILT_IN_ARCHETYPES,
  ARCHETYPE_CATEGORIES,
  buildAliasMap,
  matchArchetype,
  libraryRegistry,
} from '@norka/core'
import { useEditorStore } from '@/stores/editor'
import { useLibraryStore } from '@/stores/library'
import { BUILTIN_PRIMEREACT_ID } from '@/stores/builtin-library'
import { PRIME_PREVIEW_DEFS } from '@/composables/use-primereact-preview'
import type { PrimePreviewDef } from '@/composables/use-primereact-preview'
import { toast } from '@/utils/toast'
import ComponentPreviewItem from '@/components/ComponentPreviewItem.vue'

import type { ArchetypeCategory } from '@norka/core'

const editor = useEditorStore()
const libraryStore = useLibraryStore()

const searchQuery = ref('')
const activeCategory = ref<ArchetypeCategory | null>(null)
const collapsed = ref(false)

// Build alias map once — used to match library component names → archetype IDs
const aliasMap = buildAliasMap(BUILT_IN_ARCHETYPES)

// Map from archetypeId → best matching library component ID
const archetypeToComponentId = computed<Map<string, string>>(() => {
  const result = new Map<string, string>()
  const components = libraryRegistry.getComponents()
  for (const { node, libraryId } of components) {
    if (libraryId !== BUILTIN_PRIMEREACT_ID) continue
    const archetypeId = matchArchetype(node.name, aliasMap)
    if (archetypeId && !result.has(archetypeId)) {
      result.set(archetypeId, node.id)
    }
  }
  return result
})

// Map from archetypeId → PrimePreviewDef (for live thumbnail rendering)
// Uses the same matchArchetype logic: PrimeReact component name → archetype ID
const archetypeIdToPreviewDef = computed<Map<string, PrimePreviewDef>>(() => {
  const result = new Map<string, PrimePreviewDef>()
  for (const def of PRIME_PREVIEW_DEFS) {
    const archetypeId = matchArchetype(def.name, aliasMap)
    if (archetypeId && !result.has(archetypeId)) {
      result.set(archetypeId, def)
    }
  }
  return result
})

const CATEGORY_LABELS: Record<ArchetypeCategory, string> = {
  action: 'Действие',
  input: 'Ввод',
  display: 'Отображение',
  layout: 'Макет',
  navigation: 'Навигация',
  feedback: 'Обратная связь',
  overlay: 'Оверлей',
  data: 'Данные',
}

const filteredArchetypes = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  return BUILT_IN_ARCHETYPES.filter((a) => {
    const matchesCategory = !activeCategory.value || a.category === activeCategory.value
    const matchesSearch =
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.aliases.some((alias) => alias.includes(q))
    return matchesCategory && matchesSearch
  })
})

function insertComponent(archetypeId: string) {
  const componentId = archetypeToComponentId.value.get(archetypeId)
  if (!componentId) {
    toast.error('Компонент не найден в библиотеке')
    return
  }
  const instanceId = libraryStore.insertComponent(
    BUILTIN_PRIMEREACT_ID,
    componentId,
    editor.graph,
    editor.state.currentPageId,
  )
  if (instanceId) {
    editor.state.selectedIds = new Set([instanceId])
    editor.requestRender()
  }
}

function toggleCategory(cat: ArchetypeCategory) {
  activeCategory.value = activeCategory.value === cat ? null : cat
}

</script>

<template>
  <div
    class="flex h-full flex-col border-r border-border/60 bg-panel/80"
    :class="collapsed ? 'w-8 min-w-8' : 'w-full'"
    style="contain: paint layout style"
  >
    <!-- Header -->
    <div class="flex shrink-0 items-center gap-1.5 border-b border-border/60 px-2 py-2">
      <button
        class="flex size-5 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface"
        :title="collapsed ? 'Раскрыть панель компонентов' : 'Свернуть панель компонентов'"
        @click="collapsed = !collapsed"
      >
        <icon-lucide-panel-left-close v-if="!collapsed" class="size-3.5" />
        <icon-lucide-panel-left-open v-else class="size-3.5" />
      </button>
      <span v-if="!collapsed" class="text-[11px] font-medium text-surface">Компоненты</span>
    </div>

    <template v-if="!collapsed">
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

      <!-- Category chips -->
      <div class="flex shrink-0 flex-wrap gap-1 border-b border-border/60 px-2 py-1.5">
        <button
          v-for="cat in ARCHETYPE_CATEGORIES"
          :key="cat"
          class="rounded-full px-1.5 py-0.5 text-[10px] transition-colors"
          :class="
            activeCategory === cat
              ? 'bg-accent/20 text-accent'
              : 'bg-hover/60 text-muted hover:text-surface'
          "
          :title="CATEGORY_LABELS[cat]"
          @click="toggleCategory(cat)"
        >
          {{ CATEGORY_LABELS[cat] }}
        </button>
      </div>

      <!-- Component list -->
      <div class="flex-1 overflow-y-auto py-1">
        <div v-if="filteredArchetypes.length === 0" class="flex items-center justify-center py-8">
          <p class="text-[11px] text-muted">Ничего не найдено</p>
        </div>

        <TooltipProvider :delay-duration="600" :skip-delay-duration="100">
          <div class="grid grid-cols-3 gap-1.5 px-2 py-1">
            <TooltipRoot v-for="archetype in filteredArchetypes" :key="archetype.id">
              <TooltipTrigger as-child>
                <!-- Live PrimeReact preview if a matching def exists -->
                <template v-if="archetypeIdToPreviewDef.has(archetype.id)">
                  <ComponentPreviewItem
                    :archetype-name="archetype.name"
                    :module-path="archetypeIdToPreviewDef.get(archetype.id)!.importPath"
                    :export-name="archetypeIdToPreviewDef.get(archetype.id)!.exportName"
                    :preview-props="archetypeIdToPreviewDef.get(archetype.id)!.previewProps"
                    :is-disabled="!archetypeToComponentId.has(archetype.id)"
                    @insert="insertComponent(archetype.id)"
                  />
                </template>
                <!-- Fallback icon card for archetypes not in PRIME_PREVIEW_MAP -->
                <button
                  v-else
                  class="flex w-full flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 text-center transition-colors"
                  :class="
                    archetypeToComponentId.has(archetype.id)
                      ? 'cursor-pointer border-border/60 bg-canvas hover:border-accent/40 hover:bg-accent/5 hover:text-accent'
                      : 'cursor-default border-border/30 bg-canvas/40 opacity-40'
                  "
                  :disabled="!archetypeToComponentId.has(archetype.id)"
                  @click="insertComponent(archetype.id)"
                >
                  <div class="flex size-7 items-center justify-center rounded bg-hover/60 text-muted">
                    <icon-lucide-component class="size-4" />
                  </div>
                  <span class="line-clamp-2 text-[10px] leading-tight text-surface">
                    {{ archetype.name }}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent
                  side="right"
                  :side-offset="6"
                  class="z-50 max-w-52 rounded-md border border-border bg-panel px-2.5 py-1.5 text-[11px] text-surface shadow-md"
                >
                  <p class="font-medium">{{ archetype.name }}</p>
                  <p class="mt-0.5 text-muted">{{ archetype.description }}</p>
                  <p v-if="!archetypeToComponentId.has(archetype.id)" class="mt-1 text-[10px] text-muted/60">
                    Нет в библиотеке
                  </p>
                </TooltipContent>
              </TooltipPortal>
            </TooltipRoot>
          </div>
        </TooltipProvider>
      </div>

      <!-- Footer hint -->
      <div class="shrink-0 border-t border-border/60 px-3 py-2">
        <p class="text-[10px] text-muted">
          Нажмите на компонент, чтобы добавить его на холст
        </p>
      </div>
    </template>

    <!-- Collapsed: vertical label -->
    <template v-else>
      <div class="flex flex-1 items-center justify-center">
        <span
          class="whitespace-nowrap text-[10px] text-muted"
          style="writing-mode: vertical-rl; transform: rotate(180deg)"
        >
          Компоненты
        </span>
      </div>
    </template>
  </div>
</template>
