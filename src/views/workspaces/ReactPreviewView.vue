<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'

import { buildRenderTree, normalizeRenderPlan } from '@/ai/screen-pipeline'
import JsonContractDialog from '@/components/design/JsonContractDialog.vue'
import JsonDesignCanvas from '@/components/design/JsonDesignCanvas.vue'
import { useDialogUI } from '@/components/ui/dialog'
import { useProjects } from '@/composables/use-projects'
import {
  readFeatureFile,
  readFeatureVersions,
  workspacePath,
  writeFeatureFile,
  writeFeatureVersions
} from '@/composables/use-workspace-fs'
import { toast } from '@/utils/toast'

import type { RenderTree } from '@/ai/screen-pipeline'
import type { FeatureVersion, FeatureVersionAnalyticsRef } from '@/composables/use-workspace-fs'

const PREVIEW_LAYOUT_UPDATED_EVENT = 'norka:preview-layout:updated'

const { context, currentFeature } = useProjects()
const route = useRoute()
const versionDialogOpen = ref(false)
const pipelineStatus = ref<'ready' | 'partial' | 'invalid-contract' | 'empty'>('empty')
const showDebug = ref(false)
const jsonDialogOpen = ref(false)
const debugPayload = ref<string>('')
const renderTree = ref<RenderTree>({
  sidebar: [],
  breadcrumbs: [],
  main: [],
  actions: [],
  diagnostics: []
})
const treePayload = ref('{}')
const currentPreviewPayload = ref('')
const manualTreePayload = ref<string | null>(null)
const manualTreeRevision = ref(0)
const versions = ref<FeatureVersion[]>([])
const selectedVersionId = ref('')
const newVersionDescription = ref('')
const newVersionOwner = ref('')
const newVersionBranchId = ref('main')
const selectedVersionStatus = ref<FeatureVersion['status']>('draft')
const activeTreePayload = computed(() => manualTreePayload.value ?? treePayload.value)
const activeTreeInput = computed(() => ({
  value: activeTreePayload.value,
  revision: manualTreeRevision.value
}))
const rootNodeCount = computed(
  () =>
    renderTree.value.sidebar.length +
    renderTree.value.breadcrumbs.length +
    renderTree.value.main.length +
    renderTree.value.actions.length
)
const activeVersions = computed(() => versions.value.filter((version) => !version.isArchived))
const branchIds = computed(() => Array.from(new Set(activeVersions.value.map((version) => version.branchId ?? 'main'))))
const selectedVersion = computed(
  () => activeVersions.value.find((version) => version.id === selectedVersionId.value) ?? null
)
const currentPreviewHash = computed(() => hashText(currentPreviewPayload.value || activeTreePayload.value))
const selectedVersionHash = computed(() =>
  selectedVersion.value?.renderContract?.payload
    ? hashText(selectedVersion.value.renderContract.payload)
    : ''
)
const hasDraftChanges = computed(
  () => Boolean(selectedVersion.value) && currentPreviewHash.value !== selectedVersionHash.value
)
const cls = useDialogUI({ content: 'flex max-h-[82vh] w-[720px] max-w-[92vw] flex-col' })

function resetPipelineStatus() {
  pipelineStatus.value = 'empty'
  renderTree.value = { sidebar: [], breadcrumbs: [], main: [], actions: [], diagnostics: [] }
  treePayload.value = JSON.stringify(renderTree.value)
  debugPayload.value = ''
  currentPreviewPayload.value = ''
}

function routeContextIds() {
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
  return {
    productId,
    screenId,
    featureId
  }
}

async function findPreviewPayload(productId: string, screenId: string, featureId: string) {
  const primaryRoot = workspacePath.value ?? 'browser'
  const roots = Array.from(new Set([primaryRoot, 'browser-local', 'browser']))
  for (const root of roots) {
    const candidate = await readFeatureFile(root, productId, screenId, featureId, 'preview-layout.json')
    if (candidate.trim()) return { raw: candidate, sourceRoot: root }
  }
  return { raw: '', sourceRoot: primaryRoot }
}

function statusForCurrentTree(hasMainContent: boolean, hasAnyContent: boolean, hasDiagnostics: boolean) {
  if (hasMainContent) return hasDiagnostics ? 'partial' : 'ready'
  return hasAnyContent ? 'partial' : 'empty'
}

function applyPreviewPayload(raw: string, sourceRoot: string) {
  const parsed = JSON.parse(raw) as unknown
  const normalized = normalizeRenderPlan(parsed)
  if (!normalized.ok) {
    pipelineStatus.value = 'invalid-contract'
    debugPayload.value = JSON.stringify({ sourceRoot, diagnostics: normalized.diagnostics, raw: parsed }, null, 2)
    return
  }
  renderTree.value = buildRenderTree(normalized.enterpriseScreenPlan, normalized.assemblyPlan)
  treePayload.value = JSON.stringify(renderTree.value)
  const hasMainContent = renderTree.value.main.length > 0 || renderTree.value.actions.length > 0
  const hasAnyContent = rootNodeCount.value > 0
  const hasDiagnostics = renderTree.value.diagnostics.length > 0 || normalized.diagnostics.length > 0
  pipelineStatus.value = statusForCurrentTree(hasMainContent, hasAnyContent, hasDiagnostics)
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
}

async function loadPipelineStatus() {
  resetPipelineStatus()
  const { productId, screenId, featureId } = routeContextIds()
  if (!productId || !screenId || !featureId) return

  const { raw, sourceRoot } = await findPreviewPayload(productId, screenId, featureId)
  if (!raw.trim()) return
  currentPreviewPayload.value = raw

  try {
    applyPreviewPayload(raw, sourceRoot)
  } catch {
    pipelineStatus.value = 'invalid-contract'
  }
}

async function loadVersionData() {
  const { productId, screenId, featureId } = routeContextIds()
  if (!productId || !screenId || !featureId) return
  versions.value = await readFeatureVersions(featureRoot(), productId, screenId, featureId)
  if (!activeVersions.value.some((version) => version.id === selectedVersionId.value)) {
    selectedVersionId.value = latestVersionId(versions.value) ?? ''
  }
  syncVersionForm()
}

function applyTreeJson(raw: string) {
  manualTreePayload.value = raw
  manualTreeRevision.value += 1
}

function hashText(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}

function featureRoot(): string {
  return workspacePath.value ?? 'browser'
}

async function buildAnalyticsRef(
  root: string,
  productId: string,
  screenId: string,
  featureId: string
): Promise<FeatureVersionAnalyticsRef> {
  const analytics = await readFeatureFile(root, productId, screenId, featureId, 'analytics.md')
  return {
    sourceFile: 'analytics.md',
    hash: hashText(analytics),
    capturedAt: new Date().toISOString()
  }
}

function latestVersionId(versions: FeatureVersion[]): string | null {
  const activeVersions = versions.filter((version) => !version.isArchived)
  return [...activeVersions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id ?? null
}

function syncVersionForm() {
  newVersionDescription.value = currentFeature.value?.title ?? ''
  newVersionOwner.value = currentFeature.value?.designerFullName ?? 'Дизайнер'
  newVersionBranchId.value = selectedVersion.value?.branchId ?? 'main'
  selectedVersionStatus.value = selectedVersion.value?.status ?? 'draft'
}

async function saveCurrentDesignVersion() {
  if (!context.value) {
    toast.error('Контекст фичи не выбран')
    return
  }
  const root = featureRoot()
  const { productId, screenId, featureId } = context.value
  const previewPayload =
    currentPreviewPayload.value ||
    (await readFeatureFile(root, productId, screenId, featureId, 'preview-layout.json'))
  if (!previewPayload.trim()) {
    toast.error('Нет JSON-контракта прототипа для сохранения версии')
    return
  }
  const description = newVersionDescription.value.trim()
  if (!description) {
    toast.warning('Описание версии обязательно')
    return
  }
  const owner = newVersionOwner.value.trim()
  if (!owner) {
    toast.warning('Ответственный обязателен')
    return
  }
  const versions = await readFeatureVersions(root, productId, screenId, featureId)
  const nextIndex = versions.length + 1
  const versionId = `v${nextIndex}`
  const now = new Date().toISOString()
  const parentVersionId = latestVersionId(versions)
  versions.push({
    id: versionId,
    title: versionId,
    description,
    owner,
    createdAt: now,
    status: 'draft',
    parentVersionIds: parentVersionId ? [parentVersionId] : [],
    branchId: newVersionBranchId.value.trim() || 'main',
    analyticsRef: await buildAnalyticsRef(root, productId, screenId, featureId),
    renderContract: {
      sourceFile: 'preview-layout.json',
      payload: previewPayload,
      savedAt: now
    },
    snapshot: {
      sourceFile: 'preview-layout.json',
      payload: previewPayload,
      savedAt: now
    },
    discussionSummary: {
      total: 0,
      unresolved: 0,
      resolved: 0,
      updatedAt: now
    },
    devFeedback: []
  })
  await writeFeatureVersions(root, productId, screenId, featureId, versions)
  await loadVersionData()
  selectedVersionId.value = versionId
  versionDialogOpen.value = false
  toast.info(`Версия ${versionId} сохранена и доступна в Обсуждении`)
}

async function persistVersionChanges() {
  if (!context.value || !selectedVersion.value) return
  selectedVersion.value.status = selectedVersionStatus.value ?? 'draft'
  selectedVersion.value.owner = selectedVersion.value.owner || newVersionOwner.value.trim() || 'Дизайнер'
  const { productId, screenId, featureId } = context.value
  await writeFeatureVersions(featureRoot(), productId, screenId, featureId, versions.value)
  toast.info(`Версия ${selectedVersion.value.title} обновлена`)
}

async function restoreSelectedVersion() {
  if (!context.value || !selectedVersion.value?.renderContract?.payload) return
  const { productId, screenId, featureId } = context.value
  await writeFeatureFile(
    featureRoot(),
    productId,
    screenId,
    featureId,
    'preview-layout.json',
    selectedVersion.value.renderContract.payload
  )
  manualTreePayload.value = null
  window.dispatchEvent(new CustomEvent(PREVIEW_LAYOUT_UPDATED_EVENT))
  await loadPipelineStatus()
  toast.info(`Откатились к версии ${selectedVersion.value.title}`)
}

onMounted(() => {
  void loadPipelineStatus()
  void loadVersionData()
  window.addEventListener(PREVIEW_LAYOUT_UPDATED_EVENT, loadPipelineStatus)
})

watch([workspacePath, context, () => route.fullPath], () => {
  void loadPipelineStatus()
  void loadVersionData()
})

watch(selectedVersionId, syncVersionForm)

onUnmounted(() => {
  window.removeEventListener(PREVIEW_LAYOUT_UPDATED_EVENT, loadPipelineStatus)
})
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden">
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <div class="flex-1" />
      <span class="rounded border border-border px-2 py-0.5 text-[10px] text-muted">
        {{ pipelineStatus }}
      </span>
      <span class="rounded border border-border px-2 py-0.5 text-[10px] text-muted">
        roots: {{ rootNodeCount }}
      </span>
      <button
        class="flex items-center gap-2 rounded-lg border border-border bg-panel/70 px-2 py-1 text-left transition-colors hover:bg-hover"
        @click="versionDialogOpen = true"
      >
        <div class="mr-1 flex flex-col leading-none">
          <span class="text-[9px] uppercase tracking-wider text-muted">Версия</span>
          <span class="max-w-32 truncate text-[10px] text-surface">
            {{ selectedVersion?.title ?? 'Черновик' }}
            <template v-if="hasDraftChanges"> · draft</template>
          </span>
        </div>
        <span
          class="rounded px-1.5 py-0.5 text-[10px]"
          :class="selectedVersion ? 'bg-accent/15 text-accent' : 'bg-hover text-muted'"
        >
          {{ selectedVersion?.status ?? 'draft' }}
        </span>
        <icon-lucide-chevron-down class="size-3 text-muted" />
      </button>
      <button
        class="rounded border border-border px-2 py-0.5 text-[10px] text-muted transition-colors hover:bg-hover hover:text-surface"
        @click="jsonDialogOpen = true"
      >
        JSON
      </button>
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
          :treeJson="activeTreeInput"
        />
      </div>
    </div>
    <JsonContractDialog
      v-model:open="jsonDialogOpen"
      :initial-value="activeTreePayload"
      @apply="applyTreeJson"
    />
    <DialogRoot v-model:open="versionDialogOpen">
      <DialogPortal>
        <DialogOverlay :class="cls.overlay" />
        <DialogContent :class="cls.content">
          <div class="flex items-center gap-3 border-b border-border px-4 py-3">
            <div class="flex-1">
              <DialogTitle class="text-sm font-semibold text-surface">
                Управление версией
              </DialogTitle>
              <p class="mt-1 text-xs text-muted">
                Базовое состояние — черновик. Сохранённая версия открывает обсуждение.
              </p>
            </div>
            <DialogClose class="rounded px-2 py-1 text-xs text-muted hover:bg-hover">
              Закрыть
            </DialogClose>
          </div>

          <div class="grid min-h-0 flex-1 grid-cols-[220px_1fr] gap-0 overflow-hidden">
            <aside class="min-h-0 overflow-auto border-r border-border p-3">
              <p class="mb-2 text-[11px] uppercase tracking-wider text-muted">Ветки</p>
              <div class="mb-3 flex flex-wrap gap-1">
                <span
                  v-for="branch in branchIds"
                  :key="branch"
                  class="rounded bg-hover px-1.5 py-0.5 text-[10px] text-muted"
                >
                  {{ branch }}
                </span>
                <span v-if="branchIds.length === 0" class="text-xs text-muted">main</span>
              </div>

              <p class="mb-2 text-[11px] uppercase tracking-wider text-muted">Версии</p>
              <button
                class="mb-1 flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors"
                :class="!selectedVersionId ? 'bg-hover text-surface' : 'text-muted hover:bg-hover'"
                @click="selectedVersionId = ''"
              >
                <span>Черновик</span>
                <span class="rounded bg-canvas px-1.5 py-0.5 text-[10px]">draft</span>
              </button>
              <button
                v-for="version in activeVersions"
                :key="version.id"
                class="mb-1 flex w-full flex-col rounded px-2 py-1.5 text-left transition-colors"
                :class="
                  selectedVersionId === version.id
                    ? 'bg-hover text-surface'
                    : 'text-muted hover:bg-hover hover:text-surface'
                "
                @click="selectedVersionId = version.id"
              >
                <span class="flex items-center justify-between gap-2 text-xs">
                  <span>{{ version.title }}</span>
                  <span class="rounded bg-canvas px-1.5 py-0.5 text-[10px]">{{
                    version.status
                  }}</span>
                </span>
                <span class="mt-1 truncate text-[10px] text-muted">
                  {{ version.branchId ?? 'main' }} · {{ version.owner ?? '—' }}
                </span>
              </button>
            </aside>

            <div class="min-h-0 overflow-auto p-4">
              <section class="rounded-lg border border-border bg-canvas/40 p-3">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-xs font-medium text-surface">
                      {{ selectedVersion?.title ?? 'Черновик' }}
                    </p>
                    <p class="mt-1 text-[11px] text-muted">
                      {{
                        selectedVersion
                          ? `${selectedVersion.description || 'Без описания'} · ${new Date(selectedVersion.createdAt).toLocaleString('ru')}`
                          : 'Текущий несохранённый вариант дизайна'
                      }}
                    </p>
                  </div>
                  <button
                    class="rounded border border-border px-2 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface disabled:opacity-40"
                    :disabled="!selectedVersion"
                    @click="restoreSelectedVersion"
                  >
                    Откатиться
                  </button>
                </div>

                <div class="mt-3 grid grid-cols-2 gap-2">
                  <label class="flex flex-col gap-1 text-[11px] text-muted">
                    Статус
                    <select
                      v-model="selectedVersionStatus"
                      class="rounded border border-border bg-panel px-2 py-1 text-xs text-surface outline-none"
                      :disabled="!selectedVersion"
                    >
                      <option value="draft">draft</option>
                      <option value="in_review">in_review</option>
                      <option value="ready_for_handoff">ready_for_handoff</option>
                      <option value="handed_off">handed_off</option>
                    </select>
                  </label>
                  <label class="flex flex-col gap-1 text-[11px] text-muted">
                    Ответственный
                    <input
                      v-model="newVersionOwner"
                      class="rounded border border-border bg-panel px-2 py-1 text-xs text-surface outline-none"
                      placeholder="ФИО / роль"
                    />
                  </label>
                </div>
                <button
                  class="mt-3 rounded border border-border px-2.5 py-1 text-xs text-surface hover:bg-hover disabled:opacity-40"
                  :disabled="!selectedVersion"
                  @click="persistVersionChanges"
                >
                  Сохранить статус
                </button>
              </section>

              <section class="mt-4 rounded-lg border border-border bg-canvas/40 p-3">
                <p class="text-xs font-medium text-surface">Сохранить текущий черновик как версию</p>
                <div class="mt-3 grid grid-cols-2 gap-2">
                  <label class="flex flex-col gap-1 text-[11px] text-muted">
                    Ветка
                    <input
                      v-model="newVersionBranchId"
                      class="rounded border border-border bg-panel px-2 py-1 text-xs text-surface outline-none"
                      placeholder="main"
                    />
                  </label>
                  <label class="flex flex-col gap-1 text-[11px] text-muted">
                    Ответственный
                    <input
                      v-model="newVersionOwner"
                      class="rounded border border-border bg-panel px-2 py-1 text-xs text-surface outline-none"
                      placeholder="Дизайнер"
                    />
                  </label>
                </div>
                <label class="mt-2 flex flex-col gap-1 text-[11px] text-muted">
                  Описание версии
                  <textarea
                    v-model="newVersionDescription"
                    rows="4"
                    class="resize-none rounded border border-border bg-panel px-2 py-1 text-xs text-surface outline-none"
                    placeholder="Что зафиксировано в этой версии..."
                  />
                </label>
                <button
                  class="mt-3 rounded border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs text-accent hover:bg-accent/15"
                  @click="saveCurrentDesignVersion"
                >
                  Сохранить как версию
                </button>
              </section>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
