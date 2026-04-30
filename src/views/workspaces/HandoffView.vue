<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport
} from 'reka-ui'

import { buildRenderTree, normalizeRenderPlan } from '@/ai/screen-pipeline'
import JsonDesignCanvas from '@/components/design/JsonDesignCanvas.vue'
import {
  readFeatureComments,
  readFeatureVersions,
  useWorkspaceFs,
  writeFeatureFile,
  writeFeatureVersions,
  type FeatureComment,
  type FeatureCommentRole,
  type FeatureCommentStatus,
  type FeatureVersion
} from '@/composables/use-workspace-fs'
import { useProjects } from '@/composables/use-projects'
import { toast } from '@/utils/toast'

interface RenderNode {
  id: string
  section: string
  component_id: string
  props: Record<string, unknown>
  slot_name?: string
  parent_step_id?: string
  children?: RenderNode[]
}

interface InspectorMetrics {
  width: number
  height: number
  x: number
  y: number
}

const { context, workspacePath, currentProduct, currentScreen, currentFeature } = useProjects()
const { isDesktop } = useWorkspaceFs()

const versionComments = ref<FeatureComment[]>([])
const handoffVersions = ref<FeatureVersion[]>([])
const activePackageVersionId = ref('')
const selectedNodeId = ref<string | null>(null)
const selectedNodeMetrics = ref<InspectorMetrics | null>(null)

const activePackageVersion = computed(
  () => handoffVersions.value.find((version) => version.id === activePackageVersionId.value) ?? null
)

const packageComments = computed(() =>
  versionComments.value.filter((comment) => comment.versionId === activePackageVersionId.value)
)

const packageSummary = computed(() => {
  const total = packageComments.value.length
  const closed = packageComments.value.filter((comment) => isCommentClosed(comment)).length
  const wontDo = packageComments.value.filter((comment) =>
    commentStatusesFor(comment).includes('wont_do')
  ).length
  return {
    total,
    closed,
    wontDo,
    unresolved: total - closed,
    devFeedback: activePackageVersion.value?.devFeedback?.length ?? 0
  }
})

const packageTreeJson = computed(() => {
  const payload =
    activePackageVersion.value?.renderContract?.payload ?? activePackageVersion.value?.snapshot?.payload
  if (!payload) return ''
  try {
    const normalized = normalizeRenderPlan(JSON.parse(payload))
    if (!normalized.ok) return ''
    return JSON.stringify(buildRenderTree(normalized.enterpriseScreenPlan, normalized.assemblyPlan))
  } catch {
    return ''
  }
})

const renderNodes = computed(() => parseRenderNodes(packageTreeJson.value))
const selectedNode = computed(() =>
  selectedNodeId.value ? (renderNodes.value.get(selectedNodeId.value) ?? null) : null
)
const selectedNodeComments = computed(() =>
  selectedNodeId.value
    ? packageComments.value.filter((comment) => comment.nodeId === selectedNodeId.value)
    : []
)
const decisionComments = computed(() =>
  packageComments.value.filter((comment) => isCommentClosed(comment))
)
const frontendReviewComments = computed(() => commentsByStatus('needs_frontend'))
const backendReviewComments = computed(() => commentsByStatus('needs_backend'))
const analyticsReviewComments = computed(() => commentsByStatus('needs_analytics'))
const attentionComments = computed(() => [
  ...frontendReviewComments.value,
  ...backendReviewComments.value,
  ...analyticsReviewComments.value
])

const packageTitle = computed(
  () =>
    activePackageVersion.value?.description ||
    activePackageVersion.value?.title ||
    currentFeature.value?.title ||
    'Пакет передачи'
)

const handoffShareUrl = computed(() => {
  if (!context.value) return ''
  const { productId, screenId, featureId } = context.value
  return `norka://handoff/${productId}/${screenId}/${featureId}/${activePackageVersionId.value}`
})

function parseRenderNodes(treeJson: string): Map<string, RenderNode> {
  const nodes = new Map<string, RenderNode>()
  if (!treeJson) return nodes
  try {
    const raw = JSON.parse(treeJson) as Partial<Record<'sidebar' | 'breadcrumbs' | 'main' | 'actions', unknown>>
    const visit = (input: unknown) => {
      if (!input || typeof input !== 'object') return
      const node = input as Partial<RenderNode>
      if (typeof node.id === 'string') {
        nodes.set(node.id, {
          id: node.id,
          section: typeof node.section === 'string' ? node.section : 'unknown',
          component_id: typeof node.component_id === 'string' ? node.component_id : 'unknown',
          props: node.props && typeof node.props === 'object' && !Array.isArray(node.props)
            ? (node.props as Record<string, unknown>)
            : {},
          slot_name: typeof node.slot_name === 'string' ? node.slot_name : undefined,
          parent_step_id: typeof node.parent_step_id === 'string' ? node.parent_step_id : undefined,
          children: Array.isArray(node.children) ? (node.children as RenderNode[]) : []
        })
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) visit(child)
      }
    }
    for (const section of ['sidebar', 'breadcrumbs', 'main', 'actions'] as const) {
      const items = raw[section]
      if (!Array.isArray(items)) continue
      for (const item of items) visit(item)
    }
  } catch {
    return nodes
  }
  return nodes
}

function commentStatusesFor(comment: FeatureComment): FeatureCommentStatus[] {
  if (Array.isArray(comment.statuses) && comment.statuses.length > 0) return comment.statuses
  return comment.status === 'resolved' ? ['resolved'] : ['new']
}

function isCommentClosed(comment: FeatureComment): boolean {
  const statuses = commentStatusesFor(comment)
  return statuses.includes('resolved') || statuses.includes('wont_do')
}

function commentsByStatus(status: FeatureCommentStatus): FeatureComment[] {
  return packageComments.value.filter((comment) => commentStatusesFor(comment).includes(status))
}

function roleLabel(role?: FeatureCommentRole): string {
  switch (role) {
    case 'analyst':
      return 'Аналитик'
    case 'frontend':
      return 'Frontend'
    case 'backend':
      return 'Backend'
    case 'designer':
    default:
      return 'Дизайнер'
  }
}

function statusLabel(status: FeatureCommentStatus): string {
  switch (status) {
    case 'needs_frontend':
      return 'Проверка фронтами'
    case 'needs_backend':
      return 'Проверка бэками'
    case 'needs_analytics':
      return 'Проверка аналитиком'
    case 'wont_do':
      return 'Не будем делать'
    case 'resolved':
      return 'Решён'
    case 'new':
    default:
      return 'Новый'
  }
}

function formatDate(value?: string): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('ru')
}

function propPreview(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  const serialized = JSON.stringify(value)
  return serialized.length > 180 ? `${serialized.slice(0, 180)}…` : serialized
}

function nodeDisplayName(node: RenderNode | null): string {
  if (!node) return 'Компонент не выбран'
  const title = node.props.title ?? node.props.label ?? node.props.text ?? node.props.name
  return typeof title === 'string' ? title : node.component_id
}

function handlePreviewClick(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null
  const nodeElement = target?.closest<HTMLElement>('[data-node-id]')
  selectedNodeId.value = nodeElement?.dataset.nodeId ?? null
  if (!nodeElement) {
    selectedNodeMetrics.value = null
    return
  }
  const rect = nodeElement.getBoundingClientRect()
  selectedNodeMetrics.value = {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    x: Math.round(rect.left),
    y: Math.round(rect.top)
  }
}

async function loadPackageData() {
  if (!context.value) return
  const { productId, screenId, featureId } = context.value
  const root = workspacePath.value ?? 'browser'
  const [versions, comments] = await Promise.all([
    readFeatureVersions(root, productId, screenId, featureId),
    readFeatureComments(root, productId, screenId, featureId)
  ])
  handoffVersions.value = versions
  versionComments.value = comments
  const active =
    versions.find((version) => version.status === 'ready_for_handoff' && !version.isArchived) ??
    versions.find((version) => version.status === 'handed_off' && !version.isArchived) ??
    null
  activePackageVersionId.value = active?.id ?? ''
  if (active?.status === 'ready_for_handoff') {
    active.status = 'handed_off'
    await writeFeatureVersions(root, productId, screenId, featureId, versions)
  }
}

function buildHandoffMarkdown(): string {
  return [
    ...handoffHeaderLines(),
    ...commentListLines('Decisions', decisionComments.value, '- Нет закрытых решений.'),
    ...commentListLines('Requires Attention', attentionComments.value, '- Нет дополнительных проверок.'),
    '## Acceptance Criteria',
    '',
    ...acceptanceCriteria().map((criterion) => `- [ ] ${criterion}`),
    ''
  ].join('\n')
}

function handoffHeaderLines(): string[] {
  return [
    '# Handoff',
    '',
    `## ${packageTitle.value}`,
    '',
    ...handoffContextLines(),
    '## Analytics',
    '',
    ...handoffAnalyticsLines(),
    '',
    '## Discussion Summary',
    '',
    `- Closed: ${packageSummary.value.closed}/${packageSummary.value.total}`,
    `- Unresolved: ${packageSummary.value.unresolved}`,
    `- Dev feedback: ${packageSummary.value.devFeedback}`,
    ''
  ]
}

function handoffContextLines(): string[] {
  const version = activePackageVersion.value
  const productTitle = currentProduct.value ? currentProduct.value.title : '—'
  const screenTitle = currentScreen.value ? currentScreen.value.title : '—'
  const featureTitle = currentFeature.value ? currentFeature.value.title : '—'
  return [
    `- Product: ${productTitle}`,
    `- Screen: ${screenTitle}`,
    `- Feature: ${featureTitle}`,
    `- Version: ${version ? version.title : '—'} (${version ? version.status : '—'})`,
    `- Owner: ${version?.owner ?? '—'}`,
    `- Branch: ${version?.branchId ?? 'main'}`,
    `- Created: ${formatDate(version?.createdAt)}`,
    ''
  ]
}

function handoffAnalyticsLines(): string[] {
  const analyticsRef = activePackageVersion.value?.analyticsRef
  return [
    `- Source: ${analyticsRef?.sourceFile ?? 'analytics.md'}`,
    `- Hash: ${analyticsRef?.hash ?? '—'}`,
    `- Captured: ${formatDate(analyticsRef?.capturedAt)}`
  ]
}

function commentListLines(title: string, comments: FeatureComment[], emptyText: string): string[] {
  if (comments.length === 0) return [`## ${title}`, '', emptyText, '']
  return [
    `## ${title}`,
    '',
    ...comments.map(
      (comment) => `- ${comment.text} (${commentStatusesFor(comment).map(statusLabel).join(', ')})`
    ),
    ''
  ]
}

function buildFinalExport(): string {
  return JSON.stringify(
    {
      version: activePackageVersion.value,
      summary: packageSummary.value,
      decisions: decisionComments.value,
      attention: attentionComments.value,
      comments: packageComments.value,
      renderContract: activePackageVersion.value?.renderContract ?? activePackageVersion.value?.snapshot
    },
    null,
    2
  )
}

function acceptanceCriteria(): string[] {
  return [
    'Финальная версия макета доступна в пакете и совпадает с переданной версией.',
    'Все комментарии обсуждения закрыты или явно помечены как “не будем делать”.',
    'Проверки frontend/backend/analytics вынесены в блок “Требует внимания”.',
    'Разработчик может кликнуть компонент в макете и увидеть nodeId, размеры и свойства.'
  ]
}

async function saveHandoffMd() {
  if (!workspacePath.value || !context.value) {
    toast.error('Нет рабочей папки или контекста фичи')
    return
  }
  const { productId, screenId, featureId } = context.value
  await writeFeatureFile(
    workspacePath.value,
    productId,
    screenId,
    featureId,
    'handoff.md',
    buildHandoffMarkdown()
  )
  toast.info('handoff.md сохранён')
}

async function generateFinalExportMd() {
  if (!workspacePath.value || !context.value) {
    toast.error('Нет рабочей папки или контекста фичи')
    return
  }
  const { productId, screenId, featureId } = context.value
  await writeFeatureFile(
    workspacePath.value,
    productId,
    screenId,
    featureId,
    'final-export.json',
    buildFinalExport()
  )
  toast.info('final-export.json сохранён')
}

async function copyShareLink() {
  if (!handoffShareUrl.value) return
  await navigator.clipboard?.writeText(handoffShareUrl.value)
  toast.info('Ссылка на пакет скопирована')
}

onMounted(() => {
  void loadPackageData()
})
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden bg-canvas">
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <span class="text-xs font-medium text-surface">{{ packageTitle }}</span>
      <span class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
        {{ activePackageVersion?.status ?? 'empty' }}
      </span>
      <span class="text-[11px] text-muted">
        {{ activePackageVersion?.title ?? '—' }} · {{ activePackageVersion?.owner ?? '—' }} ·
        {{ activePackageVersion?.branchId ?? 'main' }}
      </span>

      <div class="flex-1" />

      <button
        class="rounded border border-border px-2.5 py-1 text-xs text-muted hover:bg-hover hover:text-surface"
        :disabled="!activePackageVersion"
        @click="copyShareLink"
      >
        Скопировать ссылку
      </button>
      <template v-if="isDesktop">
        <button
          class="rounded border border-border px-2.5 py-1 text-xs text-muted hover:bg-hover hover:text-surface"
          :disabled="!activePackageVersion"
          @click="saveHandoffMd"
        >
          handoff.md
        </button>
        <button
          class="rounded border border-border px-2.5 py-1 text-xs text-muted hover:bg-hover hover:text-surface"
          :disabled="!activePackageVersion"
          @click="generateFinalExportMd"
        >
          final-export.json
        </button>
      </template>
    </header>

    <div v-if="!activePackageVersion" class="flex flex-1 items-center justify-center text-muted">
      Нет версии, готовой к handoff.
    </div>

    <div v-else class="min-h-0 flex flex-1 overflow-hidden">
      <main class="min-w-0 flex flex-1 flex-col gap-2 overflow-hidden p-2">
        <section class="shrink-0 rounded-lg border border-border bg-panel px-3 py-2">
          <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-surface">{{ packageTitle }}</p>
              <p class="truncate text-[11px] text-muted">
                {{ activePackageVersion.description || currentProduct?.title || 'Итоговый пакет версии' }}
              </p>
            </div>
            <div class="grid grid-cols-4 gap-1.5 text-[10px] text-muted">
              <div class="rounded border border-border bg-canvas px-2 py-1">
                Owner: <span class="text-surface">{{ activePackageVersion.owner ?? '—' }}</span>
              </div>
              <div class="rounded border border-border bg-canvas px-2 py-1">
                Comments: <span class="text-surface">{{ packageSummary.closed }}/{{ packageSummary.total }}</span>
              </div>
              <div class="rounded border border-border bg-canvas px-2 py-1">
                Feedback: <span class="text-surface">{{ packageSummary.devFeedback }}</span>
              </div>
              <div class="rounded border border-border bg-canvas px-2 py-1">
                Analytics:
                <span class="font-mono text-surface">{{ activePackageVersion.analyticsRef?.hash ?? '—' }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="min-h-0 flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-panel">
          <div class="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
            <div>
              <h2 class="text-xs font-semibold text-surface">Макет версии</h2>
              <p class="text-[10px] text-muted">Клик по компоненту открывает inspector справа.</p>
            </div>
            <span class="text-[10px] text-muted">
              {{ activePackageVersion.id }} · {{ formatDate(activePackageVersion.createdAt) }}
            </span>
          </div>
          <div class="min-h-0 flex-1 overflow-hidden bg-canvas" @click.capture="handlePreviewClick">
            <JsonDesignCanvas :tree-json="packageTreeJson" />
          </div>
        </section>

        <section class="grid h-44 shrink-0 grid-cols-3 gap-2">
          <div class="min-h-0 overflow-hidden rounded-lg border border-border bg-panel p-3">
            <h2 class="text-xs font-semibold text-surface">Решения</h2>
            <ScrollAreaRoot class="mt-2 h-[124px]">
              <ScrollAreaViewport class="h-full pr-2">
                <div v-if="decisionComments.length === 0" class="text-xs text-muted">
                  Закрытых решений нет.
                </div>
                <div v-else class="flex flex-col gap-1.5">
                  <article
                    v-for="comment in decisionComments"
                    :key="comment.id"
                    class="rounded border border-border bg-canvas px-2 py-1.5"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <span class="truncate text-[10px] font-medium text-surface">{{ comment.author }}</span>
                      <span class="shrink-0 text-[9px] text-muted">{{ formatDate(comment.createdAt) }}</span>
                    </div>
                    <p class="mt-1 line-clamp-2 text-[11px] text-surface/85">{{ comment.text }}</p>
                  </article>
                </div>
              </ScrollAreaViewport>
            </ScrollAreaRoot>
          </div>

          <div class="min-h-0 overflow-hidden rounded-lg border border-border bg-panel p-3">
            <h2 class="text-xs font-semibold text-surface">Требует внимания</h2>
            <ScrollAreaRoot class="mt-2 h-[124px]">
              <ScrollAreaViewport class="h-full pr-2">
                <div v-if="attentionComments.length === 0" class="text-xs text-muted">
                  Дополнительных проверок нет.
                </div>
                <div v-else class="flex flex-col gap-1.5">
                  <article
                    v-for="comment in attentionComments"
                    :key="`${comment.id}-${commentStatusesFor(comment).join('-')}`"
                    class="rounded border border-border bg-canvas px-2 py-1.5"
                  >
                    <p class="line-clamp-2 text-[11px] text-surface/85">{{ comment.text }}</p>
                    <div class="mt-1 flex flex-wrap gap-1">
                      <span
                        v-for="status in commentStatusesFor(comment).filter((item) => item.startsWith('needs_'))"
                        :key="status"
                        class="rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent"
                      >
                        {{ statusLabel(status) }}
                      </span>
                    </div>
                  </article>
                </div>
              </ScrollAreaViewport>
            </ScrollAreaRoot>
          </div>

          <div class="min-h-0 overflow-hidden rounded-lg border border-border bg-panel p-3">
            <h2 class="text-xs font-semibold text-surface">DoD / артефакты</h2>
            <ul class="mt-2 flex flex-col gap-1 text-[11px] text-surface/85">
              <li v-for="criterion in acceptanceCriteria().slice(0, 3)" :key="criterion" class="flex gap-1.5">
                <icon-lucide-check class="mt-0.5 size-3 shrink-0 text-emerald-400" />
                <span class="line-clamp-1">{{ criterion }}</span>
              </li>
            </ul>
            <div class="mt-2 rounded border border-border bg-canvas px-2 py-1 text-[10px] text-muted">
              preview-layout.json ·
              {{ activePackageVersion.renderContract?.savedAt ? formatDate(activePackageVersion.renderContract.savedAt) : '—' }}
            </div>
          </div>
        </section>
      </main>

      <aside class="flex w-72 shrink-0 flex-col border-l border-border bg-panel">
        <header class="border-b border-border px-3 py-2">
          <p class="text-xs font-semibold text-surface">Inspector</p>
          <p class="text-[10px] text-muted">Readonly данные выбранного компонента</p>
        </header>
        <ScrollAreaRoot class="min-h-0 flex-1">
          <ScrollAreaViewport class="h-full p-3">
            <div v-if="!selectedNode" class="rounded-lg border border-dashed border-border p-4 text-xs text-muted">
              Выберите компонент в макете, чтобы посмотреть размеры, свойства и связанные решения.
            </div>
            <div v-else class="flex flex-col gap-3">
              <div class="rounded-lg border border-border bg-canvas p-3">
                <p class="text-xs font-semibold text-surface">{{ nodeDisplayName(selectedNode) }}</p>
                <p class="mt-1 font-mono text-[10px] text-muted">{{ selectedNode.id }}</p>
                <p class="mt-1 text-[10px] text-muted">
                  {{ selectedNode.component_id }} · {{ selectedNode.section }}
                </p>
              </div>

              <div class="rounded-lg border border-border bg-canvas p-3">
                <p class="mb-2 text-[11px] font-medium text-surface">Размеры</p>
                <div class="grid grid-cols-2 gap-2 text-[11px] text-muted">
                  <span>W: {{ selectedNodeMetrics?.width ?? '—' }} px</span>
                  <span>H: {{ selectedNodeMetrics?.height ?? '—' }} px</span>
                  <span>X: {{ selectedNodeMetrics?.x ?? '—' }}</span>
                  <span>Y: {{ selectedNodeMetrics?.y ?? '—' }}</span>
                </div>
              </div>

              <div class="min-h-0 rounded-lg border border-border bg-canvas p-3">
                <p class="mb-2 text-[11px] font-medium text-surface">Props</p>
                <div v-if="Object.keys(selectedNode.props).length === 0" class="text-xs text-muted">
                  Нет свойств.
                </div>
                <div v-else class="flex max-h-48 flex-col gap-1 overflow-auto pr-1">
                  <div
                    v-for="[key, value] in Object.entries(selectedNode.props)"
                    :key="key"
                    class="grid grid-cols-[72px_1fr] gap-2 text-[10px]"
                  >
                    <span class="truncate text-muted">{{ key }}</span>
                    <span class="break-all font-mono text-surface/80">{{ propPreview(value) }}</span>
                  </div>
                </div>
              </div>

              <div class="rounded-lg border border-border bg-canvas p-3">
                <p class="mb-2 text-[11px] font-medium text-surface">Комментарии по узлу</p>
                <div v-if="selectedNodeComments.length === 0" class="text-xs text-muted">
                  К этому компоненту нет решений.
                </div>
                <div v-else class="flex flex-col gap-2">
                  <article
                    v-for="comment in selectedNodeComments"
                    :key="comment.id"
                    class="rounded border border-border px-2 py-1.5"
                  >
                    <p class="text-xs text-surface/85">{{ comment.text }}</p>
                    <p class="mt-1 text-[10px] text-muted">
                      {{ comment.author }} · {{ roleLabel(comment.role) }}
                    </p>
                  </article>
                </div>
              </div>
            </div>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
            <ScrollAreaThumb class="rounded-full bg-border" />
          </ScrollAreaScrollbar>
        </ScrollAreaRoot>
      </aside>
    </div>
  </div>
</template>
