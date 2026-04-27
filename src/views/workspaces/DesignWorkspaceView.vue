<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useWorkspaceFs } from '@/composables/use-workspace-fs'
import { useProjects } from '@/composables/use-projects'
import { useProtoStore } from '@/composables/use-proto-store'
import type { ProtoSerializedNode } from '@/composables/use-proto-store'
import { setActiveEditorStore } from '@/stores/editor'
import { useLinterStore } from '@/stores/linter'
import { createTab, getActiveStore } from '@/stores/tabs'
import { toast } from '@/utils/toast'
import ReactPreviewView from '@/views/workspaces/ReactPreviewView.vue'

import type { EditorStore } from '@/stores/editor'

interface SlotAwarePreviewLayoutDraft {
  screen: string
  shell: {
    wrapper: 'fixed'
    left: { width: 249; miniBar: 48; divider: 1; sideBar: 200 }
    main: { breadcrumbs: true; contentOnlyEditable: true }
  }
  breadcrumbs: Array<{ label: string }>
  contentBlocks: Array<{
    component: string
    props?: Record<string, unknown>
    childrenText?: string
  }>
  nodes: Array<{
    component: string
    props?: Record<string, unknown>
    childrenText?: string
  }>
  protoTree?: ProtoSerializedNode[]
}

function ensureActiveEditorStore(): EditorStore {
  try {
    const active = getActiveStore()
    setActiveEditorStore(active)
    return active
  } catch {
    const created = createTab()
    setActiveEditorStore(created.store)
    return created.store
  }
}

const router = useRouter()
const editor = ensureActiveEditorStore()
const linterStore = useLinterStore()
const protoStore = useProtoStore()
const { workspacePath, readFeatureFile, writeFeatureFile } = useWorkspaceFs()
const { context, currentProduct, currentScreen, currentFeature, markStepVisited } = useProjects()

const hasPreviewArtifact = ref(false)
const isSavingDraft = ref(false)
const analyticsStateCoverage = ref(false)

const currentPageNode = computed(() => editor.graph.getNode(editor.state.currentPageId))
const currentPageChildren = computed(() => currentPageNode.value?.childIds ?? [])

function isNodeInCurrentPage(nodeId: string): boolean {
  let current = editor.graph.getNode(nodeId)
  while (current) {
    if (current.parentId === editor.state.currentPageId) return true
    current = current.parentId ? editor.graph.getNode(current.parentId) : null
  }
  return false
}

const instanceCountOnPage = computed(() =>
  [...editor.graph.nodes.values()].filter((node) => node.type === 'INSTANCE' && isNodeInCurrentPage(node.id)).length,
)
const usesLibraryComponents = computed(() => instanceCountOnPage.value > 0)
const lintErrorCount = computed(() => linterStore.results.value?.errorCount ?? 0)
const noCriticalLayoutErrors = computed(() => lintErrorCount.value === 0)
const hasScreenStates = computed(() => {
  const namedStates = currentPageChildren.value
    .map((id) => editor.graph.getNode(id)?.name.toLowerCase() ?? '')
    .filter(Boolean)
  const hasStateKeyword = namedStates.some((name) =>
    /(default|hover|loading|empty|error|disabled|success|active)/.test(name),
  )
  return currentPageChildren.value.length >= 2 || hasStateKeyword
})

const qualityChecks = computed(() => [
  { id: 'states', label: 'Ключевые состояния экрана', ok: hasScreenStates.value },
  { id: 'analytics', label: 'Покрытие аналитических состояний', ok: analyticsStateCoverage.value },
  { id: 'library', label: 'Используются библиотечные компоненты', ok: usesLibraryComponents.value },
  { id: 'layout', label: 'Нет критичных layout-ошибок', ok: noCriticalLayoutErrors.value },
  { id: 'draft', label: 'Подготовлен draft-артефакт', ok: hasPreviewArtifact.value },
])

const canOpenDiscussion = computed(() => qualityChecks.value.filter((check) => check.ok).length >= 4)
const qualityScore = computed(() => qualityChecks.value.filter((check) => check.ok).length)

const featureSummary = computed(
  () =>
    `${currentProduct.value?.title ?? 'Продукт'} / ${currentScreen.value?.title ?? 'Экран'} / ${currentFeature.value?.title ?? 'Фича'}`,
)

const breadcrumbs = computed(() => ([
  { label: currentProduct.value?.title ?? 'Продукт' },
  { label: currentScreen.value?.title ?? 'Экран' },
  { label: currentFeature.value?.title ?? 'Фича' },
]))

function buildPreviewLayoutDraft(): SlotAwarePreviewLayoutDraft {
  const nodes = [...editor.graph.nodes.values()]
    .filter((node) => node.type === 'INSTANCE' && isNodeInCurrentPage(node.id))
    .slice(0, 24)
    .map((node) => {
      const componentNode = node.componentId ? editor.graph.getNode(node.componentId) : null
      return {
        component: componentNode?.name ?? node.name,
        props: { className: 'w-full' },
      }
    })
  return {
    screen: currentFeature.value?.title ?? 'Untitled screen',
    shell: {
      wrapper: 'fixed',
      left: { width: 249, miniBar: 48, divider: 1, sideBar: 200 },
      main: { breadcrumbs: true, contentOnlyEditable: true },
    },
    breadcrumbs: breadcrumbs.value,
    contentBlocks: nodes,
    nodes,
    protoTree: protoStore.toSerializedTree(),
  }
}

async function refreshPreviewArtifact() {
  if (!workspacePath.value || !context.value) {
    hasPreviewArtifact.value = false
    analyticsStateCoverage.value = false
    return
  }
  const { productId, screenId, featureId } = context.value
  const [existing, analyticsMd, implementationMd] = await Promise.all([
    readFeatureFile(workspacePath.value, productId, screenId, featureId, 'preview-layout.json'),
    readFeatureFile(workspacePath.value, productId, screenId, featureId, 'analytics.md'),
    readFeatureFile(workspacePath.value, productId, screenId, featureId, 'implementation-ready.md'),
  ])
  hasPreviewArtifact.value = existing.trim().length > 0
  const source = `${analyticsMd}\n${implementationMd}`.toLowerCase()
  const required = ['loading', 'empty', 'error', 'success'].filter((s) => source.includes(s))
  if (required.length === 0) {
    analyticsStateCoverage.value = true
  } else {
    const names = currentPageChildren.value
      .map((id) => editor.graph.getNode(id)?.name.toLowerCase() ?? '')
      .filter(Boolean)
      .join(' ')
    analyticsStateCoverage.value = required.every((state) => names.includes(state))
  }
}

async function saveDraft() {
  if (!workspacePath.value || !context.value) {
    toast.error('Workspace или контекст фичи не выбраны')
    return
  }
  isSavingDraft.value = true
  try {
    const payload = buildPreviewLayoutDraft()
    const { productId, screenId, featureId } = context.value
    await writeFeatureFile(
      workspacePath.value,
      productId,
      screenId,
      featureId,
      'preview-layout.json',
      JSON.stringify(payload, null, 2),
    )
    await refreshPreviewArtifact()
    markStepVisited(productId, screenId, featureId, 'design')
    toast.success('Draft сохранен в preview-layout.json')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    isSavingDraft.value = false
  }
}

async function openDiscussion() {
  if (!canOpenDiscussion.value) {
    toast.error('Сначала пройдите минимальные quality checks')
    return
  }
  if (!hasPreviewArtifact.value) {
    await saveDraft()
  }
  if (!context.value) return
  const { productId, screenId, featureId } = context.value
  markStepVisited(productId, screenId, featureId, 'discussion')
  await router.push('/workspace/discussion')
}

watch(
  () => editor.state.sceneVersion,
  () => {
    linterStore.run(editor.graph, editor.state.currentPageId)
  },
)

watch([workspacePath, context], () => {
  void refreshPreviewArtifact()
})

onMounted(() => {
  linterStore.run(editor.graph, editor.state.currentPageId)
  void refreshPreviewArtifact()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-canvas">
    <div class="min-h-0 flex-1 overflow-hidden">
      <ReactPreviewView />
    </div>

    <footer class="flex shrink-0 items-center gap-2 border-t border-border/60 bg-panel px-3 py-2">
      <div class="mr-2 hidden min-w-0 flex-1 items-center gap-2 lg:flex">
        <span class="text-[11px] text-muted">Quality Gate {{ qualityScore }}/{{ qualityChecks.length }}</span>
        <span
          v-for="item in qualityChecks"
          :key="item.id"
          class="rounded px-1.5 py-0.5 text-[10px]"
          :class="item.ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-hover text-muted'"
        >
          {{ item.label }}
        </span>
      </div>
      <button
        class="rounded border border-border px-2.5 py-1 text-xs text-surface hover:bg-hover disabled:opacity-50"
        :disabled="isSavingDraft"
        @click="saveDraft"
      >
        Сохранить черновик
      </button>
      <button
        class="ml-auto rounded px-3 py-1.5 text-xs font-medium"
        :class="
          canOpenDiscussion
            ? 'bg-emerald-500/25 text-emerald-200 hover:bg-emerald-500/35'
            : 'cursor-not-allowed bg-hover text-muted'
        "
        :disabled="!canOpenDiscussion"
        @click="openDiscussion"
      >
        К обсуждению
      </button>
    </footer>
  </div>
</template>
