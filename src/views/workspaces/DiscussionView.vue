<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { buildRenderTree, normalizeRenderPlan } from '@/ai/screen-pipeline'
import JsonDesignCanvas from '@/components/design/JsonDesignCanvas.vue'
import Tip from '@/components/ui/Tip.vue'
import { useProjects } from '@/composables/use-projects'
import { initialsForName, roleLabel, useWorkspaceUser } from '@/composables/use-workspace-user'
import {
  useWorkspaceFs,
  type FeatureComment,
  type FeatureCommentRole,
  type FeatureCommentStatus,
  type FeatureVersion
} from '@/composables/use-workspace-fs'
import { buildWorkspacePath } from '@/utils/workspace-route'
import { toast } from '@/utils/toast'

import type { Vector } from '@norka/core'

const router = useRouter()
const { context, workspacePath, grantHandoffAccess, markStepVisited } = useProjects()
const { currentUser } = useWorkspaceUser()
const {
  isDesktop,
  readFeatureComments,
  writeFeatureComments,
  readFeatureVersions,
  writeFeatureVersions,
  writeFeatureFile
} = useWorkspaceFs()

type FilterType = 'all' | 'open' | 'resolved'

const activeFilter = ref<FilterType>('all')
const activeCommentId = ref<string | null>(null)
const hoverCommentId = ref<string | null>(null)
const activeVersionId = ref('')
const replyText = ref('')
const newCommentText = ref('')
const pendingAnchor = ref<Vector | null>(null)
const pendingNodeId = ref<string | null>(null)
const canvasRoot = ref<HTMLElement | null>(null)
const newCommentTextarea = ref<HTMLTextAreaElement | null>(null)

const comments = ref<FeatureComment[]>([])
const versions = ref<FeatureVersion[]>([])

const commentStatuses: Array<{ value: FeatureCommentStatus; label: string }> = [
  { value: 'new', label: 'Новый' },
  { value: 'needs_frontend', label: 'Проверка фронтами' },
  { value: 'needs_backend', label: 'Проверка бэками' },
  { value: 'needs_analytics', label: 'Проверка аналитиком' },
  { value: 'wont_do', label: 'Не будем делать' },
  { value: 'resolved', label: 'Решён' }
]

const visibleComments = computed(() => {
  const statusFiltered = comments.value.filter((comment) => {
    if (activeFilter.value === 'open') return !isCommentClosed(comment)
    if (activeFilter.value === 'resolved') return isCommentClosed(comment)
    return true
  })
  return statusFiltered.filter((comment) => comment.versionId === activeVersionId.value)
})

const activeComment = computed(
  () => comments.value.find((comment) => comment.id === activeCommentId.value) ?? null
)

const currentVersion = computed(
  () => versions.value.find((version) => version.id === activeVersionId.value) ?? null
)

const activeVersions = computed(() => versions.value.filter((version) => !version.isArchived))
const hasSavedVersions = computed(() => activeVersions.value.length > 0)
const unresolvedCount = computed(
  () =>
    comments.value.filter(
      (comment) => comment.versionId === activeVersionId.value && !isCommentClosed(comment)
    ).length
)

const versionTreeJson = computed(() => {
  const payload = currentVersion.value?.renderContract?.payload ?? currentVersion.value?.snapshot?.payload
  if (!payload) return ''
  try {
    const normalized = normalizeRenderPlan(JSON.parse(payload))
    if (!normalized.ok) return ''
    return JSON.stringify(buildRenderTree(normalized.enterpriseScreenPlan, normalized.assemblyPlan))
  } catch {
    return ''
  }
})

async function loadDiscussionData() {
  if (!context.value) return
  const { productId, screenId, featureId } = context.value
  const root = workspacePath.value ?? 'browser'
  comments.value = await readFeatureComments(root, productId, screenId, featureId)
  versions.value = await readFeatureVersions(root, productId, screenId, featureId)
  if (!versions.value.some((version) => version.id === activeVersionId.value)) {
    activeVersionId.value = activeVersions.value[0]?.id ?? ''
  }
}

async function persistComments() {
  if (!context.value) return
  const { productId, screenId, featureId } = context.value
  const root = workspacePath.value ?? 'browser'
  await writeFeatureComments(root, productId, screenId, featureId, comments.value)
  await updateCurrentVersionSummary()
}

function selectComment(id: string) {
  activeCommentId.value = id
}

async function addComment() {
  if (!newCommentText.value.trim() || !pendingAnchor.value || !activeVersionId.value) return
  const createdComment: FeatureComment = {
    id: `c-${Date.now()}`,
    versionId: activeVersionId.value,
    status: 'open',
    statuses: ['new'],
    role: currentUser.value.role,
    author: currentUser.value.name,
    text: newCommentText.value.trim(),
    createdAt: new Date().toISOString(),
    nodeId: pendingNodeId.value ?? undefined,
    anchor: pendingAnchor.value,
    replies: []
  }
  comments.value.push(createdComment)
  newCommentText.value = ''
  activeCommentId.value = createdComment.id
  pendingAnchor.value = null
  pendingNodeId.value = null
  await persistComments()
}

async function sendReply() {
  if (!replyText.value.trim() || !activeComment.value) return
  activeComment.value.replies.push({
    id: `r-${Date.now()}`,
    author: currentUser.value.name,
    role: currentUser.value.role,
    text: replyText.value.trim(),
    createdAt: new Date().toISOString()
  })
  replyText.value = ''
  await persistComments()
}

async function saveDiscussionMd() {
  if (!context.value) {
    toast.error('Нет рабочей папки или контекста фичи')
    return
  }
  const lines: string[] = ['# Discussion\n']
  for (const comment of comments.value) {
    lines.push(`## ${comment.id} [${commentStatusesFor(comment).join(', ')}] version=${comment.versionId}`)
    lines.push(`Author: ${comment.author} | Created: ${comment.createdAt}`)
    if (comment.resolvedInVersionId) lines.push(`Resolved in: ${comment.resolvedInVersionId}`)
    lines.push('')
    lines.push(comment.text)
    lines.push('')
  }
  const { productId, screenId, featureId } = context.value
  const root = workspacePath.value ?? 'browser'
  await writeFeatureFile(
    root,
    productId,
    screenId,
    featureId,
    'discussion.md',
    lines.join('\n')
  )
  toast.info('discussion.md сохранён')
}

async function handleCanvasClick(event: MouseEvent) {
  if (!currentVersion.value) return
  const element = canvasRoot.value
  if (!element) return
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return
  const target = event.target instanceof Element ? event.target : null
  const nodeElement = target?.closest<HTMLElement>('[data-node-id]')
  pendingAnchor.value = {
    x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
    y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1)
  }
  pendingNodeId.value = nodeElement?.dataset.nodeId ?? null
  activeCommentId.value = null
  await nextTick()
  newCommentTextarea.value?.focus()
}

function commentStatusesFor(comment: FeatureComment): FeatureCommentStatus[] {
  if (Array.isArray(comment.statuses) && comment.statuses.length > 0) return comment.statuses
  return comment.status === 'resolved' ? ['resolved'] : ['new']
}

function isCommentClosed(comment: FeatureComment): boolean {
  const statuses = commentStatusesFor(comment)
  return statuses.includes('resolved') || statuses.includes('wont_do')
}

function isCommentStatusActive(comment: FeatureComment, status: FeatureCommentStatus): boolean {
  return commentStatusesFor(comment).includes(status)
}

function syncLegacyStatus(comment: FeatureComment) {
  if (isCommentClosed(comment)) {
    comment.status = 'resolved'
    comment.resolvedAt = comment.resolvedAt ?? new Date().toISOString()
    comment.resolvedInVersionId = comment.resolvedInVersionId ?? activeVersionId.value
    return
  }
  comment.status = commentStatusesFor(comment).some((status) => status !== 'new') ? 'in_progress' : 'open'
  comment.resolvedAt = undefined
  comment.resolvedInVersionId = undefined
}

function appendResolvedReply(comment: FeatureComment) {
  const timestamp = new Date()
  const formatted = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(timestamp)
  comment.replies.push({
    id: `r-${Date.now()}`,
    author: currentUser.value.name,
    role: currentUser.value.role,
    text: `Закрыт ${formatted}. Закрыл(а): ${currentUser.value.name}.`,
    createdAt: timestamp.toISOString()
  })
}

function setExclusiveCommentStatus(comment: FeatureComment, status: FeatureCommentStatus) {
  comment.statuses = [status]
  syncLegacyStatus(comment)
}

async function toggleCommentStatus(status: FeatureCommentStatus) {
  if (!activeComment.value) return
  const wasClosed = isCommentClosed(activeComment.value)
  if (status === 'resolved' || status === 'wont_do' || status === 'new') {
    setExclusiveCommentStatus(activeComment.value, status)
    if (status === 'resolved' && !wasClosed) appendResolvedReply(activeComment.value)
    await persistComments()
    return
  }
  const current = commentStatusesFor(activeComment.value).filter(
    (item) => item !== 'new' && item !== 'resolved' && item !== 'wont_do'
  )
  activeComment.value.statuses = current.includes(status)
    ? current.filter((item) => item !== status)
    : [...current, status]
  if (activeComment.value.statuses.length === 0) activeComment.value.statuses = ['new']
  syncLegacyStatus(activeComment.value)
  await persistComments()
}

function commentInitials(comment: FeatureComment): string {
  const author = typeof comment.author === 'string' ? comment.author : roleLabel(comment.role)
  return initialsForName(author) || roleLabel(comment.role).slice(0, 2).toUpperCase()
}

function roleBubbleClass(role?: FeatureCommentRole): string {
  switch (role) {
    case 'analyst':
      return 'border-sky-300 bg-sky-400 text-sky-950'
    case 'frontend':
      return 'border-amber-300 bg-amber-400 text-amber-950'
    case 'backend':
      return 'border-violet-300 bg-violet-400 text-violet-950'
    case 'designer':
    default:
      return 'border-pink-300 bg-pink-400 text-pink-950'
  }
}

function recentReplyAvatars(comment: FeatureComment): Array<{
  id: string
  author: string
  role?: FeatureCommentRole
}> {
  return comment.replies.slice(-3).reverse().map((reply) => ({
    id: reply.id,
    author: reply.author,
    role: reply.role ?? comment.role
  }))
}

function lastReplyRole(comment: FeatureComment): FeatureCommentRole | undefined {
  const lastReply = comment.replies[comment.replies.length - 1]
  return lastReply?.role ?? comment.role
}

function reviewDots(comment: FeatureComment): FeatureCommentRole[] {
  const statuses = commentStatusesFor(comment)
  const dots: FeatureCommentRole[] = []
  if (statuses.includes('needs_frontend')) dots.push('frontend')
  if (statuses.includes('needs_backend')) dots.push('backend')
  if (statuses.includes('needs_analytics')) dots.push('analyst')
  return dots
}

function roleDotClass(role: FeatureCommentRole): string {
  switch (role) {
    case 'analyst':
      return 'bg-sky-400'
    case 'frontend':
      return 'bg-amber-400'
    case 'backend':
      return 'bg-violet-400'
    case 'designer':
    default:
      return 'bg-pink-400'
  }
}

function activeThreadStyle(comment: FeatureComment) {
  return {
    left: `${(comment.anchor?.x ?? 0.5) * 100}%`,
    top: `${(comment.anchor?.y ?? 0.5) * 100}%`
  }
}

async function handoffFromDiscussion() {
  if (!context.value || !hasSavedVersions.value) return
  if (!activeVersionId.value) return
  if (unresolvedCount.value > 0) {
    toast.error('Нельзя передать в handoff: есть нерешённые комментарии')
    return
  }
  const { productId, screenId, featureId } = context.value
  const version = currentVersion.value
  if (!version) return
  version.status = 'ready_for_handoff'
  await persistVersions()
  grantHandoffAccess(productId, screenId, featureId, activeVersionId.value)
  markStepVisited(productId, screenId, featureId, 'handoff')
  await router.push(buildWorkspacePath('handoff', { productId, screenId, featureId }))
}

async function persistVersions() {
  if (!context.value) return
  const { productId, screenId, featureId } = context.value
  await writeFeatureVersions(workspacePath.value ?? 'browser', productId, screenId, featureId, versions.value)
}

async function updateCurrentVersionSummary() {
  const version = currentVersion.value
  if (!version) return
  const versionComments = comments.value.filter((comment) => comment.versionId === version.id)
  const unresolved = versionComments.filter((comment) => !isCommentClosed(comment)).length
  version.discussionSummary = {
    total: versionComments.length,
    unresolved,
    resolved: versionComments.length - unresolved,
    updatedAt: new Date().toISOString()
  }
  if (unresolved > 0 && version.status === 'ready_for_handoff') {
    version.status = 'in_review'
  }
  await persistVersions()
}

function descendantIds(rootVersionId: string): Set<string> {
  const ids = new Set<string>([rootVersionId])
  let changed = true
  while (changed) {
    changed = false
    for (const version of versions.value) {
      if (ids.has(version.id)) continue
      if ((version.parentVersionIds ?? []).some((parentId) => ids.has(parentId))) {
        ids.add(version.id)
        changed = true
      }
    }
  }
  return ids
}

async function archiveCurrentSubtree() {
  const version = currentVersion.value
  if (!version || !window.confirm(`Архивировать подветку ${version.title}?`)) return
  const ids = descendantIds(version.id)
  const now = new Date().toISOString()
  for (const item of versions.value) {
    if (!ids.has(item.id)) continue
    item.isArchived = true
    item.archivedAt = now
    item.archivedBy = 'Дизайнер'
    item.archiveRootId = version.id
  }
  activeVersionId.value = activeVersions.value.find((item) => !ids.has(item.id))?.id ?? ''
  await persistVersions()
}

async function mergeIntoCurrentVersion() {
  const target = currentVersion.value
  if (!target) return
  const candidates = activeVersions.value.filter((version) => version.id !== target.id)
  if (candidates.length === 0) {
    toast.warning('Нет другой ветки/версии для merge')
    return
  }
  const sourceId = window.prompt(
    `ID версии для merge: ${candidates.map((version) => version.id).join(', ')}`
  )?.trim()
  const source = candidates.find((version) => version.id === sourceId)
  if (!source) {
    toast.warning('Версия для merge не найдена')
    return
  }
  const now = new Date().toISOString()
  const versionId = `v${versions.value.length + 1}`
  versions.value.push({
    ...target,
    id: versionId,
    title: `${target.title}+${source.title}`,
    description: `Merge ${source.title} into ${target.title}`,
    createdAt: now,
    status: 'in_review',
    parentVersionIds: [target.id, source.id],
    branchId: target.branchId ?? 'main',
    devFeedback: [...(target.devFeedback ?? []), ...(source.devFeedback ?? [])],
    isArchived: false,
    archivedAt: undefined,
    archivedBy: undefined,
    archiveRootId: undefined
  })
  activeVersionId.value = versionId
  await persistVersions()
  toast.info(`Создан merge ${versionId}`)
}

onMounted(() => {
  void loadDiscussionData()
})
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden">
    <!-- Top bar -->
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <button
        class="rounded border border-border px-2.5 py-1 text-xs text-surface hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!hasSavedVersions || !activeVersionId || unresolvedCount > 0"
        @click="handoffFromDiscussion"
      >
        Передать версию в handoff
      </button>
      <button
        class="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors"
        :class="
          activeComment && !isCommentClosed(activeComment)
            ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
            : 'cursor-not-allowed text-muted opacity-50'
        "
        :disabled="!activeComment || isCommentClosed(activeComment)"
        @click="toggleCommentStatus('resolved')"
      >
        <icon-lucide-check class="size-3.5" />
        Отметить решённым
      </button>

      <div class="h-4 w-px bg-border" />

      <!-- Filter chips -->
      <div class="flex items-center gap-1">
        <button
          v-for="(f, label) in { all: 'Все', open: 'Открытые', resolved: 'Решённые' }"
          :key="f"
          class="rounded px-2 py-0.5 text-[11px] transition-colors"
          :class="
            activeFilter === f
              ? 'bg-accent/15 text-accent'
              : 'text-muted hover:bg-hover hover:text-surface'
          "
          @click="activeFilter = f as FilterType"
        >
          {{ label }}
        </button>
      </div>
      <div class="h-4 w-px bg-border" />
      <select
        v-model="activeVersionId"
        class="rounded border border-border bg-canvas px-2 py-1 text-xs text-surface"
        :title="
          currentVersion
            ? `${currentVersion.title}\n${currentVersion.description ?? ''}\nОтветственный: ${currentVersion.owner ?? '—'}\nСоздана: ${new Date(currentVersion.createdAt).toLocaleString('ru')}\nВетка: ${currentVersion.branchId ?? 'main'}`
            : ''
        "
      >
        <option v-for="v in activeVersions" :key="v.id" :value="v.id">
          {{ v.title }} · {{ v.status }}
        </option>
      </select>
      <span v-if="currentVersion" class="text-[11px] text-muted">
        {{ currentVersion.owner ?? '—' }} · {{ currentVersion.branchId ?? 'main' }} ·
        {{ new Date(currentVersion.createdAt).toLocaleString('ru') }}
      </span>
      <button
        class="rounded border border-border px-2.5 py-1 text-xs text-surface hover:bg-hover"
        :disabled="!currentVersion"
        @click="archiveCurrentSubtree"
      >
        Архивировать подветку
      </button>
      <button
        class="rounded border border-border px-2.5 py-1 text-xs text-surface hover:bg-hover"
        :disabled="activeVersions.length < 2"
        @click="mergeIntoCurrentVersion"
      >
        Merge
      </button>
      <span v-if="hasSavedVersions && unresolvedCount > 0" class="text-[11px] text-amber-400">
        Осталось нерешённых: {{ unresolvedCount }}
      </span>

      <div class="flex-1" />

      <Tip v-if="isDesktop" label="Сохранить discussion.md" side="bottom">
        <button
          class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
          @click="saveDiscussionMd"
        >
          <icon-lucide-save class="size-3.5" />
          Сохранить
        </button>
      </Tip>
    </header>

    <!-- Body -->
    <div class="min-h-0 flex flex-1 flex-col overflow-hidden bg-canvas">
        <div v-if="!hasSavedVersions" class="flex flex-1 items-center justify-center p-6 text-muted">
          Нет сохранённых версий. Обсуждение и handoff недоступны.
        </div>
        <div v-else class="relative min-h-0 flex flex-1 flex-col overflow-hidden">
          <div
            ref="canvasRoot"
            class="relative min-h-0 flex-1 overflow-hidden rounded border border-border/60"
            @click="handleCanvasClick"
          >
            <JsonDesignCanvas :tree-json="versionTreeJson" />
            <div
              v-for="(c, idx) in visibleComments"
              :key="c.id"
              class="absolute z-20 -translate-x-1/2 -translate-y-1/2"
              :style="{ left: `${(c.anchor?.x ?? 0.5) * 100}%`, top: `${(c.anchor?.y ?? 0.5) * 100}%` }"
              @mouseenter="hoverCommentId = c.id"
              @mouseleave="hoverCommentId = null"
            >
              <button
                class="flex size-7 items-center justify-center rounded-full border-2 text-[10px] font-bold shadow-lg transition-all"
                :class="[
                  roleBubbleClass(c.role),
                  isCommentClosed(c) ? 'opacity-35' : 'opacity-100',
                  activeCommentId === c.id ? 'ring-2 ring-white ring-offset-2 ring-offset-canvas' : ''
                ]"
                @click.stop="selectComment(c.id)"
              >
                <span class="sr-only">Комментарий {{ idx + 1 }}</span>
                {{ commentInitials(c) }}
              </button>
              <div
                v-if="reviewDots(c).length > 0"
                class="pointer-events-none absolute left-1/2 top-full mt-0.5 flex -translate-x-1/2 items-center gap-0.5"
              >
                <span
                  v-for="(dotRole, dotIdx) in reviewDots(c)"
                  :key="`${c.id}-review-dot-${dotRole}-${dotIdx}`"
                  class="size-2 rounded-full border border-canvas/60"
                  :class="roleDotClass(dotRole)"
                />
              </div>
              <span
                v-if="c.replies.length > 0"
                class="pointer-events-none absolute -right-2 -top-2 flex min-w-4 items-center justify-center rounded-full border px-1 text-[9px] font-bold leading-4 shadow"
                :class="roleBubbleClass(lastReplyRole(c))"
              >
                {{ c.replies.length }}
              </span>
              <div
                v-if="hoverCommentId === c.id && c.replies.length > 1"
                class="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-[115%] rounded-full border border-border bg-panel/95 px-1.5 py-1 shadow-lg backdrop-blur"
              >
                <div class="flex items-center">
                  <span
                    v-for="reply in recentReplyAvatars(c)"
                    :key="reply.id"
                    class="-ml-1.5 flex size-5 items-center justify-center rounded-full border text-[8px] font-bold first:ml-0"
                    :class="roleBubbleClass(reply.role)"
                  >
                    {{ initialsForName(reply.author) }}
                  </span>
                </div>
              </div>
            </div>
            <div
              v-if="pendingAnchor"
              class="absolute z-30 w-80 translate-x-5 -translate-y-3 rounded-xl border border-border bg-panel shadow-2xl"
              :style="{ left: `${pendingAnchor.x * 100}%`, top: `${pendingAnchor.y * 100}%` }"
              @click.stop
            >
              <div class="border-b border-border px-3 py-2">
                <p class="text-xs font-semibold text-surface">Новый комментарий</p>
              </div>
              <div class="p-3">
                <div class="mb-2 flex items-center gap-2 rounded-lg bg-canvas/70 px-2 py-1.5">
                  <span
                    class="flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold"
                    :class="roleBubbleClass(currentUser.role)"
                  >
                    {{ initialsForName(currentUser.name) }}
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-xs font-medium text-surface">{{ currentUser.name }}</p>
                    <p class="text-[10px] text-muted">{{ roleLabel(currentUser.role) }}</p>
                  </div>
                </div>
                <textarea
                  ref="newCommentTextarea"
                  v-model="newCommentText"
                  rows="2"
                  placeholder="Напишите комментарий..."
                  class="w-full resize-none rounded border border-border bg-canvas px-2 py-1.5 text-xs text-surface outline-none"
                  @keydown.enter.exact.prevent="addComment"
                />
                <p class="mt-1 text-[10px] text-muted">Enter — отправить, Shift+Enter — новая строка</p>
                <div class="mt-2 flex items-center justify-between gap-2">
                  <button
                    class="rounded px-2 py-1 text-xs text-muted hover:bg-hover"
                    @click="pendingAnchor = null; pendingNodeId = null; newCommentText = ''"
                  >
                    Отмена
                  </button>
                  <button
                    class="rounded bg-accent px-2.5 py-1 text-xs text-white hover:bg-accent/80 disabled:opacity-40"
                    :disabled="!newCommentText.trim()"
                    @click="addComment"
                  >
                    Отправить
                  </button>
                </div>
              </div>
            </div>
            <div
              v-if="activeComment"
              class="absolute z-30 w-80 translate-x-5 -translate-y-3 rounded-xl border border-border bg-panel shadow-2xl"
              :style="activeThreadStyle(activeComment)"
              @click.stop
            >
              <div class="flex items-center gap-2 border-b border-border px-3 py-2">
                <span
                  class="flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold"
                  :class="[roleBubbleClass(activeComment.role), isCommentClosed(activeComment) ? 'opacity-50' : '']"
                >
                  {{ commentInitials(activeComment) }}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs font-medium text-surface">{{ activeComment.author }}</p>
                  <p class="text-[10px] text-muted">
                    {{ roleLabel(activeComment.role) }} ·
                    {{ new Date(activeComment.createdAt).toLocaleString('ru') }}
                  </p>
                </div>
                <button
                  class="rounded border border-border px-2 py-1 text-[10px] text-muted transition-colors hover:bg-hover hover:text-surface"
                  aria-label="Закрыть комментарий"
                  @click="activeCommentId = null"
                >
                  <icon-lucide-x class="size-3" />
                </button>
              </div>
              <div class="flex flex-wrap gap-1 border-b border-border px-3 py-2">
                <button
                  v-for="statusItem in commentStatuses"
                  :key="statusItem.value"
                  class="rounded-full border px-2 py-0.5 text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                  :class="
                    isCommentStatusActive(activeComment, statusItem.value)
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border text-muted hover:bg-hover hover:text-surface'
                  "
                  :disabled="isCommentClosed(activeComment)"
                  :aria-disabled="isCommentClosed(activeComment)"
                  :title="isCommentClosed(activeComment) ? 'Комментарий закрыт' : undefined"
                  :data-disabled="isCommentClosed(activeComment) ? '' : undefined"
                  @click="toggleCommentStatus(statusItem.value)"
                >
                  {{ statusItem.label }}
                </button>
              </div>
              <div class="max-h-80 overflow-auto p-3">
                <p class="text-xs leading-relaxed text-surface">{{ activeComment.text }}</p>
                <div v-if="activeComment.replies.length" class="mt-3 flex flex-col gap-2">
                  <div
                    v-for="reply in activeComment.replies"
                    :key="reply.id"
                    class="rounded-lg bg-canvas/60 px-2 py-1.5"
                  >
                    <div class="mb-1 flex items-center justify-between gap-2">
                      <span class="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-surface">
                        <span
                          class="flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold"
                          :class="roleBubbleClass(reply.role)"
                        >
                          {{ initialsForName(reply.author) }}
                        </span>
                        <span class="truncate">{{ reply.author }}</span>
                        <span class="shrink-0 text-[10px] font-normal text-muted">
                          {{ roleLabel(reply.role) }}
                        </span>
                      </span>
                      <span class="text-[10px] text-muted">{{
                        new Date(reply.createdAt).toLocaleString('ru')
                      }}</span>
                    </div>
                    <p class="text-xs text-surface/80">{{ reply.text }}</p>
                  </div>
                </div>
              </div>
              <div v-if="!isCommentClosed(activeComment)" class="border-t border-border p-2">
                <div class="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] text-muted">
                  <span>Отвечает</span>
                  <span class="text-surface">{{ currentUser.name }}</span>
                  <span>· {{ roleLabel(currentUser.role) }}</span>
                </div>
                <textarea
                  v-model="replyText"
                  rows="2"
                  placeholder="Ответить…"
                  class="w-full resize-none rounded border border-border bg-canvas px-2 py-1.5 text-xs text-surface outline-none placeholder:text-muted"
                  @keydown.enter.exact.prevent="sendReply"
                />
                <button
                  class="mt-1 w-full rounded border border-border px-2 py-1 text-xs text-surface hover:bg-hover disabled:opacity-40"
                  :disabled="!replyText.trim()"
                  @click="sendReply"
                >
                  Ответить
                </button>
              </div>
              <div v-else class="border-t border-border px-3 py-2 text-[11px] text-muted">
                Комментарий закрыт. Обсуждение завершено.
              </div>
            </div>
          </div>
        </div>
    </div>
  </div>
</template>
