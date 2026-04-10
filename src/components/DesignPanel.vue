<script setup lang="ts">
import { computed, ref } from 'vue'

import { useI18n, useSelectionState, useEditorCommands } from '@beresta/vue'
import { useAIChat } from '@/composables/use-chat'

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
    <PageSection />
    <VariablesSection @open-dialog="variablesOpen = true" @open-token-export="tokenExportOpen = true" />
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
