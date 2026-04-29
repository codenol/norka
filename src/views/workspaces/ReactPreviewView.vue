<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'

import { usePrimeTheme } from '@/composables/use-prime-theme'
import { readFeatureFile, workspacePath } from '@/composables/use-workspace-fs'
import { useProjects } from '@/composables/use-projects'
import { provideProtoStore } from '@/composables/use-proto-store'
import ChatPanel from '@/components/ChatPanel.vue'
import ProtoComponentPanel from '@/components/proto/ProtoComponentPanel.vue'
import ProtoCanvas from '@/components/proto/ProtoCanvas.vue'
import ProtoPropsPanel from '@/components/proto/ProtoPropsPanel.vue'

const store = provideProtoStore()
const { nodes, mode } = store
const { theme, themes } = usePrimeTheme()
const { context } = useProjects()
const assumedCount = computed(() => nodes.filter((node) => node.source === 'assumed').length)
const missingCount = computed(
  () =>
    nodes.filter(
      (node) =>
        typeof node.props.__missingComponent === 'boolean' && node.props.__missingComponent === true
    ).length
)
const canOpenPrototype = computed(() => mode.value !== 'view')
const pipelineStatus = ref('Сборка')
const showDebug = ref(false)
const debugPayload = ref<string>('')
const PREVIEW_LAYOUT_UPDATED_EVENT = 'norka:preview-layout:updated'

async function loadPipelineStatus() {
  pipelineStatus.value = 'Сборка'
  debugPayload.value = ''
  if (!context.value) return
  const root = workspacePath.value ?? 'browser'
  const { productId, screenId, featureId } = context.value
  const raw = await readFeatureFile(root, productId, screenId, featureId, 'preview-layout.json')
  if (!raw.trim()) return
  try {
    const parsed = JSON.parse(raw) as {
      flow?: { status?: string }
      qualityGate?: { passed?: boolean; failReasons?: string[] }
    }
    if (parsed.qualityGate?.passed) pipelineStatus.value = 'Готово'
    else if (parsed.qualityGate?.passed === false) pipelineStatus.value = 'Черновик неполный'
    else pipelineStatus.value = parsed.flow?.status ?? 'Сборка'
    if (nodes.length > 0 && pipelineStatus.value === 'Черновик неполный') {
      pipelineStatus.value = 'Собрано (нужна проверка)'
    }
    debugPayload.value = JSON.stringify(parsed, null, 2)
  } catch {
    pipelineStatus.value = 'Сборка'
  }
}

function trySwitchMode(next: 'editor' | 'view') {
  if (next === 'view' && !canOpenPrototype.value) {
    return
  }
  mode.value = next
}

onMounted(() => {
  void loadPipelineStatus()
  window.addEventListener(PREVIEW_LAYOUT_UPDATED_EVENT, loadPipelineStatus)
})

watch([workspacePath, context], () => {
  void loadPipelineStatus()
})

onUnmounted(() => {
  window.removeEventListener(PREVIEW_LAYOUT_UPDATED_EVENT, loadPipelineStatus)
})

</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden">
    <!-- Header toolbar -->
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <!-- Mode switcher -->
      <div class="flex items-center gap-0.5 rounded border border-border p-0.5">
        <button
          class="flex items-center gap-1 rounded px-2.5 py-0.5 text-[11px] transition-colors"
          :class="mode === 'editor' ? 'bg-hover text-surface' : 'text-muted hover:text-surface'"
          @click="trySwitchMode('editor')"
        >
          <icon-lucide-pencil class="size-3" />
          Редактор
        </button>
        <button
          class="flex items-center gap-1 rounded px-2.5 py-0.5 text-[11px] transition-colors"
          :class="mode === 'view' ? 'bg-hover text-surface' : 'text-muted hover:text-surface'"
          :disabled="!canOpenPrototype"
          :title="canOpenPrototype ? 'Прототип' : 'Прототип недоступен'"
          @click="trySwitchMode('view')"
        >
          <icon-lucide-play class="size-3" />
          Прототип
        </button>
      </div>

      <!-- Node count -->
      <span class="text-[11px] text-muted">
        {{ nodes.length }}
        {{ nodes.length === 1 ? 'компонент' : nodes.length < 5 ? 'компонента' : 'компонентов' }}
      </span>

      <select
        v-model="theme"
        class="rounded border border-border bg-canvas px-2 py-1 text-[11px] text-muted outline-none focus:border-accent/60"
      >
        <option v-for="item in themes" :key="item.id" :value="item.id">
          {{ item.label }}
        </option>
      </select>

      <div class="flex-1" />

      <!-- Clear button -->
      <button
        v-if="nodes.length > 0"
        class="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
        @click="store.clearAll()"
      >
        <icon-lucide-trash-2 class="size-3" />
        Очистить
      </button>

      <span
        v-if="assumedCount > 0"
        class="rounded border border-pink-500/60 bg-pink-500/15 px-2 py-0.5 text-[10px] text-pink-300"
      >
        Assumptions: {{ assumedCount }}
      </span>
      <span
        v-if="missingCount > 0"
        class="rounded border border-amber-500/60 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-200"
      >
        Missing: {{ missingCount }}
      </span>
      <span class="rounded border border-border px-2 py-0.5 text-[10px] text-muted">
        {{ pipelineStatus }}
      </span>
      <button
        class="rounded border border-border px-2 py-0.5 text-[10px] text-muted transition-colors hover:bg-hover hover:text-surface"
        @click="showDebug = !showDebug"
      >
        {{ showDebug ? 'Hide debug' : 'Debug' }}
      </button>
    </header>

    <!-- Main layout -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left: component panel + AI chat (editor only) -->
      <div
        v-if="mode !== 'view'"
        class="flex h-full w-[360px] min-w-[320px] shrink-0 flex-col border-r border-border/60 bg-panel"
      >
        <div class="h-1/2 min-h-0">
          <ProtoComponentPanel :embedded="true" class="h-full w-full" />
        </div>
        <div class="h-px shrink-0 bg-border/60" />
        <div class="h-1/2 min-h-0">
          <ChatPanel canvas-target="proto" class="h-full w-full" />
        </div>
      </div>

      <!-- Center: canvas -->
      <div class="flex flex-1 flex-col overflow-hidden bg-canvas">
        <div
          v-if="showDebug && debugPayload"
          class="max-h-48 overflow-auto border-b border-border bg-panel/60 p-2 font-mono text-[10px] text-muted"
        >
          <pre>{{ debugPayload }}</pre>
        </div>
        <div class="h-full overflow-auto">
          <ProtoCanvas />
        </div>
      </div>

      <!-- Right: props panel (editor only) -->
      <ProtoPropsPanel v-if="mode !== 'view'" />
    </div>
  </div>
</template>
