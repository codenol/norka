<script setup lang="ts">
import { computed, ref } from 'vue'

import { useI18n, useSelectionState, useEditorCommands } from '@norka/vue'
import { libraryRegistry } from '@norka/core'
import { useAIChat } from '@/composables/use-chat'
import { useEditorStore } from '@/stores/editor'
import { useLibraryStore } from '@/stores/library'

import VariablesDialog from './VariablesDialog.vue'
import StylesDialog from './StylesDialog.vue'
import LibraryDialog from './LibraryDialog.vue'
import LibraryPanel from './LibraryPanel.vue'
import TokenExportDialog from './TokenExportDialog.vue'
import AppearanceSection from './properties/AppearanceSection.vue'
import EffectsSection from './properties/EffectsSection.vue'
import ExportSection from './properties/ExportSection.vue'
import FillSection from './properties/FillSection.vue'
import LayoutSection from './properties/LayoutSection.vue'
import PageSection from './properties/PageSection.vue'
import PositionSection from './properties/PositionSection.vue'
import StrokeSection from './properties/StrokeSection.vue'
import TypographySection from './properties/TypographySection.vue'
import VariablesSection from './properties/VariablesSection.vue'
import StylesSection from './properties/StylesSection.vue'
import StyleBadge from './properties/StyleBadge.vue'
import LibrarySection from './properties/LibrarySection.vue'
import LintSection from './properties/LintSection.vue'
import ComponentRulesSection from './properties/ComponentRulesSection.vue'
import CodeConnectDialog from './CodeConnectDialog.vue'

const { activeTab } = useAIChat()
const variablesOpen = ref(false)
const stylesOpen = ref(false)
const libraryDialogOpen = ref(false)
const libraryPanelOpen = ref(false)
const tokenExportOpen = ref(false)
const codeConnectOpen = ref(false)
const { selectedNode: node, selectedCount: multiCount } = useSelectionState()
const { getCommand } = useEditorCommands()
const goToMainComponent = getCommand('selection.goToMainComponent')
const detachInstance = getCommand('selection.detachInstance')
const editor = useEditorStore()
const libraryStore = useLibraryStore()

type ManualCategory = 'all' | 'layout' | 'form' | 'data' | 'feedback'
interface QuickComponent {
  libraryId: string
  componentId: string
  name: string
  category: Exclude<ManualCategory, 'all'>
}

const manualSearch = ref('')
const manualCategory = ref<ManualCategory>('all')
const manualCategories: { key: ManualCategory; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'layout', label: 'Layout' },
  { key: 'form', label: 'Form' },
  { key: 'data', label: 'Data' },
  { key: 'feedback', label: 'Feedback' }
]

function classifyComponent(name: string): Exclude<ManualCategory, 'all'> {
  const lower = name.toLowerCase()
  if (/(input|dropdown|checkbox|radio|select|password|textarea|slider|calendar)/.test(lower))
    return 'form'
  if (/(table|chart|list|tree|grid|menu|tab|accordion)/.test(lower)) return 'data'
  if (/(dialog|toast|badge|tag|message|alert|progress|skeleton)/.test(lower)) return 'feedback'
  return 'layout'
}

const manualComponents = computed<QuickComponent[]>(() =>
  libraryRegistry.getComponents().map(({ libraryId, node }) => ({
    libraryId,
    componentId: node.id,
    name: node.name,
    category: classifyComponent(node.name)
  }))
)

const filteredManualComponents = computed(() => {
  const query = manualSearch.value.trim().toLowerCase()
  return manualComponents.value.filter((component) => {
    if (manualCategory.value !== 'all' && component.category !== manualCategory.value) return false
    if (!query) return true
    return component.name.toLowerCase().includes(query)
  })
})

function insertManualComponent(component: QuickComponent) {
  const instanceId = libraryStore.insertComponent(
    component.libraryId,
    component.componentId,
    editor.graph,
    editor.state.currentPageId
  )
  if (!instanceId) return
  editor.state.selectedIds = new Set([instanceId])
  editor.requestRender()
}

const isComponentType = computed(() => {
  const t = node.value?.type
  return t === 'COMPONENT' || t === 'COMPONENT_SET' || t === 'INSTANCE'
})
const { panels } = useI18n()
</script>

<template>
  <!-- Multi-select summary -->
  <div
    v-if="multiCount > 1"
    data-test-id="design-panel-multi"
    class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
  >
    <div
      data-test-id="design-multi-header"
      class="flex items-center gap-1.5 border-b border-border px-3 py-2"
    >
      <span class="text-[11px] text-muted">{{ panels.mixed }}</span>
      <span class="text-xs font-semibold">{{
        panels.layersCount({ count: String(multiCount) })
      }}</span>
    </div>
    <PositionSection />
    <AppearanceSection />
    <FillSection />
    <StrokeSection />
    <EffectsSection />
  </div>

  <!-- Single selection -->
  <div
    v-else-if="node"
    data-test-id="design-panel-single"
    class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
  >
    <div
      data-test-id="design-node-header"
      class="flex items-center gap-1.5 border-b border-border px-3 py-2"
    >
      <span class="text-[11px]" :class="isComponentType ? 'text-component' : 'text-muted'">{{
        node.type
      }}</span>
      <span class="text-xs font-semibold">{{ node.name }}</span>
    </div>

    <!-- Component actions -->
    <div
      v-if="node.type === 'INSTANCE'"
      class="flex flex-col gap-1 border-b border-border px-3 py-2"
    >
      <button
        data-test-id="design-go-to-component"
        class="rounded bg-component/10 px-2 py-1 text-left text-[11px] text-component hover:bg-component/20"
        @click="goToMainComponent.run()"
      >
        {{ panels.goToMainComponent }}
      </button>
      <button
        data-test-id="design-detach-instance"
        class="rounded px-2 py-1 text-left text-[11px] text-muted hover:bg-hover"
        @click="detachInstance.run()"
      >
        {{ panels.detachInstance }}
      </button>
    </div>

    <!-- Component rules (for library instances) -->
    <ComponentRulesSection
      v-if="node.type === 'INSTANCE' && node.componentId"
      :component-node-id="node.componentId"
      @open-code-connect="codeConnectOpen = true"
    />

    <PositionSection />
    <LayoutSection />
    <AppearanceSection />
    <StyleBadge v-if="node.type === 'TEXT'" style-type="TEXT" @open-styles="stylesOpen = true" />
    <TypographySection v-if="node.type === 'TEXT'" />
    <StyleBadge style-type="FILL" @open-styles="stylesOpen = true" />
    <FillSection />
    <StrokeSection />
    <StyleBadge style-type="EFFECT" @open-styles="stylesOpen = true" />
    <EffectsSection />

    <ExportSection />
  </div>

  <div
    v-else
    data-test-id="design-panel-empty"
    class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
  >
    <div class="border-b border-border">
      <div class="px-3 py-2">
        <p class="text-[11px] font-medium text-surface">Компоненты</p>
        <p class="text-[10px] text-muted">Ручная сборка экрана</p>
      </div>
      <div class="space-y-2 px-3 pb-2">
        <input
          v-model="manualSearch"
          type="text"
          class="w-full rounded border border-border bg-input px-2 py-1 text-xs text-surface outline-none"
          placeholder="Поиск компонента..."
        />
        <div class="flex flex-wrap gap-1">
          <button
            v-for="item in manualCategories"
            :key="item.key"
            class="rounded border px-1.5 py-0.5 text-[10px]"
            :class="
              manualCategory === item.key
                ? 'border-accent/50 bg-accent/15 text-accent'
                : 'border-border text-muted hover:text-surface'
            "
            @click="manualCategory = item.key"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
      <div class="max-h-44 overflow-y-auto border-t border-border px-2 py-2">
        <button
          v-for="item in filteredManualComponents"
          :key="`${item.libraryId}:${item.componentId}`"
          class="mb-1 flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-hover"
          @click="insertManualComponent(item)"
        >
          <span class="truncate text-xs text-surface">{{ item.name }}</span>
          <icon-lucide-plus class="size-3 text-muted" />
        </button>
      </div>
    </div>

    <PageSection />
    <VariablesSection
      @open-dialog="variablesOpen = true"
      @open-token-export="tokenExportOpen = true"
    />
    <StylesSection @open-dialog="stylesOpen = true" />
    <LibrarySection @open-panel="libraryPanelOpen = true" @open-dialog="libraryDialogOpen = true" />
    <LintSection @open-panel="activeTab = 'lint'" />
    <ExportSection />
  </div>

  <VariablesDialog v-model:open="variablesOpen" />
  <StylesDialog v-model:open="stylesOpen" />
  <LibraryDialog v-model:open="libraryDialogOpen" />
  <LibraryPanel v-model:open="libraryPanelOpen" />
  <TokenExportDialog v-model:open="tokenExportOpen" />
  <CodeConnectDialog v-model:open="codeConnectOpen" />
</template>
