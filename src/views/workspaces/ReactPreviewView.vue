<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { buildRenderTree, normalizeRenderPlan } from '@/ai/screen-pipeline'
import JsonDesignCanvas from '@/components/design/JsonDesignCanvas.vue'
import { usePrimeTheme } from '@/composables/use-prime-theme'
import { useProjects } from '@/composables/use-projects'
import { readFeatureFile, workspacePath } from '@/composables/use-workspace-fs'

import type { RenderTree } from '@/ai/screen-pipeline'

const PREVIEW_LAYOUT_UPDATED_EVENT = 'norka:preview-layout:updated'

const { theme, themes } = usePrimeTheme()
const { context } = useProjects()
const route = useRoute()
const pipelineStatus = ref<'ready' | 'partial' | 'invalid-contract' | 'empty'>('empty')
const showDebug = ref(false)
const debugPayload = ref<string>('')
const renderTree = ref<RenderTree>({
  sidebar: [],
  breadcrumbs: [],
  main: [],
  actions: [],
  diagnostics: []
})
const treePayload = ref('{}')
const rootNodeCount = computed(
  () =>
    renderTree.value.sidebar.length +
    renderTree.value.breadcrumbs.length +
    renderTree.value.main.length +
    renderTree.value.actions.length
)

async function loadPipelineStatus() {
  pipelineStatus.value = 'empty'
  renderTree.value = { sidebar: [], breadcrumbs: [], main: [], actions: [], diagnostics: [] }
  treePayload.value = JSON.stringify(renderTree.value)
  debugPayload.value = ''

  const primaryRoot = workspacePath.value ?? 'browser'
  const roots = Array.from(new Set([primaryRoot, 'browser-local', 'browser']))
  const productId =
    (typeof route.params.productId === 'string' ? route.params.productId : '') ||
    context.value?.productId ||
    ''
  const screenId =
    (typeof route.params.screenId === 'string' ? route.params.screenId : '') || context.value?.screenId || ''
  const featureId =
    (typeof route.params.featureId === 'string' ? route.params.featureId : '') ||
    context.value?.featureId ||
    ''
  if (!productId || !screenId || !featureId) return

  let raw = ''
  let sourceRoot = primaryRoot
  for (const root of roots) {
    const candidate = await readFeatureFile(root, productId, screenId, featureId, 'preview-layout.json')
    if (candidate.trim()) {
      raw = candidate
      sourceRoot = root
      break
    }
  }
  if (!raw.trim()) return

  try {
    const parsed = JSON.parse(raw) as unknown
    const normalized = normalizeRenderPlan(parsed)
    if (!normalized.ok) {
      pipelineStatus.value = 'invalid-contract'
      debugPayload.value = JSON.stringify(
        { sourceRoot, diagnostics: normalized.diagnostics, raw: parsed },
        null,
        2
      )
      return
    }
    renderTree.value = buildRenderTree(normalized.enterpriseScreenPlan, normalized.assemblyPlan)
    treePayload.value = JSON.stringify(renderTree.value)
    const hasMainContent = renderTree.value.main.length > 0 || renderTree.value.actions.length > 0
    const hasAnyContent =
      renderTree.value.sidebar.length +
        renderTree.value.breadcrumbs.length +
        renderTree.value.main.length +
        renderTree.value.actions.length >
      0
    pipelineStatus.value = hasMainContent
      ? renderTree.value.diagnostics.length > 0 || normalized.diagnostics.length > 0
        ? 'partial'
        : 'ready'
      : hasAnyContent
        ? 'partial'
        : 'empty'
    debugPayload.value = JSON.stringify(
      {
        sourceRoot,
        contractVersion: normalized.contractVersion,
        normalizeDiagnostics: normalized.diagnostics,
        renderDiagnostics: renderTree.value.diagnostics,
        renderTree: renderTree.value
      },
      null,
      2
    )
  } catch {
    pipelineStatus.value = 'invalid-contract'
  }
}

onMounted(() => {
  void loadPipelineStatus()
  window.addEventListener(PREVIEW_LAYOUT_UPDATED_EVENT, loadPipelineStatus)
})

watch([workspacePath, context, () => route.fullPath], () => {
  void loadPipelineStatus()
})

onUnmounted(() => {
  window.removeEventListener(PREVIEW_LAYOUT_UPDATED_EVENT, loadPipelineStatus)
})
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden">
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <span class="text-[11px] text-muted">Design</span>

      <select
        v-model="theme"
        class="rounded border border-border bg-canvas px-2 py-1 text-[11px] text-muted outline-none focus:border-accent/60"
      >
        <option v-for="item in themes" :key="item.id" :value="item.id">
          {{ item.label }}
        </option>
      </select>

      <div class="flex-1" />
      <span class="rounded border border-border px-2 py-0.5 text-[10px] text-muted">
        {{ pipelineStatus }}
      </span>
      <span class="rounded border border-border px-2 py-0.5 text-[10px] text-muted">
        roots: {{ rootNodeCount }}
      </span>
      <button
        class="rounded border border-border px-2 py-0.5 text-[10px] text-muted transition-colors hover:bg-hover hover:text-surface"
        @click="showDebug = !showDebug"
      >
        {{ showDebug ? 'Hide debug' : 'Debug' }}
      </button>
    </header>

    <div class="flex flex-1 flex-col overflow-hidden bg-canvas">
      <div
        v-if="showDebug && debugPayload"
        class="max-h-48 overflow-auto border-b border-border bg-panel/60 p-2 font-mono text-[10px] text-muted"
      >
        <pre>{{ debugPayload }}</pre>
      </div>
      <div class="h-full overflow-auto">
        <JsonDesignCanvas
          :treeJson="treePayload"
        />
      </div>
    </div>
  </div>
</template>
