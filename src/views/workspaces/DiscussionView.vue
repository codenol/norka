<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
  SplitterGroup,
  SplitterPanel,
  SplitterResizeHandle,
} from 'reka-ui'

import Tip from '@/components/ui/Tip.vue'
import { toast } from '@/utils/toast'
import { useProjects } from '@/composables/use-projects'
import { useWorkspaceFs, type FeatureComment, type FeatureVersion } from '@/composables/use-workspace-fs'

const { context, workspacePath } = useProjects()
const {
  isDesktop,
  readFeatureComments,
  writeFeatureComments,
  readFeatureVersions,
  writeFeatureVersions,
  writeFeatureFile,
} = useWorkspaceFs()

type FilterType = 'all' | 'open' | 'resolved'

const activeFilter = ref<FilterType>('all')
const activeCommentId = ref<string | null>(null)
const activeVersionId = ref('v1')
const replyText = ref('')
const newCommentText = ref('')

const comments = ref<FeatureComment[]>([])
const versions = ref<FeatureVersion[]>([])

const visibleComments = computed(() => {
  const statusFiltered = comments.value.filter((c) => {
    if (activeFilter.value === 'open') return c.status !== 'resolved'
    if (activeFilter.value === 'resolved') return c.status === 'resolved'
    return true
  })
  return statusFiltered.filter((c) => c.versionId === activeVersionId.value || c.status !== 'resolved')
})

const activeComment = computed(() =>
  comments.value.find((c) => c.id === activeCommentId.value) ?? null,
)

const currentVersion = computed(() => versions.value.find((v) => v.id === activeVersionId.value) ?? null)

async function loadDiscussionData() {
  if (!workspacePath.value || !context.value) return
  const { productId, screenId, featureId } = context.value
  comments.value = await readFeatureComments(workspacePath.value, productId, screenId, featureId)
  versions.value = await readFeatureVersions(workspacePath.value, productId, screenId, featureId)
  if (versions.value.length === 0) {
    versions.value = [{ id: 'v1', title: 'v1', createdAt: new Date().toISOString(), notes: 'Initial version' }]
    await writeFeatureVersions(workspacePath.value, productId, screenId, featureId, versions.value)
  }
  if (!versions.value.some((v) => v.id === activeVersionId.value)) {
    activeVersionId.value = versions.value[0]?.id ?? 'v1'
  }
}

async function persistComments() {
  if (!workspacePath.value || !context.value) return
  const { productId, screenId, featureId } = context.value
  await writeFeatureComments(workspacePath.value, productId, screenId, featureId, comments.value)
}

function selectComment(id: string) {
  activeCommentId.value = id
}

async function addComment() {
  if (!newCommentText.value.trim()) return
  comments.value.push({
    id: `c-${Date.now()}`,
    versionId: activeVersionId.value,
    status: 'open',
    author: 'Дизайнер',
    text: newCommentText.value.trim(),
    createdAt: new Date().toISOString(),
    replies: [],
  })
  newCommentText.value = ''
  await persistComments()
}

async function sendReply() {
  if (!replyText.value.trim() || !activeComment.value) return
  activeComment.value.replies.push({
    id: `r-${Date.now()}`,
    author: 'Дизайнер',
    text: replyText.value.trim(),
    createdAt: new Date().toISOString(),
  })
  replyText.value = ''
  await persistComments()
}

async function resolveComment() {
  if (!activeComment.value) return
  activeComment.value.status = 'resolved'
  activeComment.value.resolvedAt = new Date().toISOString()
  activeComment.value.resolvedInVersionId = activeVersionId.value
  await persistComments()
  toast.info('Комментарий отмечен как решённый')
}

async function createNewVersion() {
  if (!workspacePath.value || !context.value) return
  const { productId, screenId, featureId } = context.value
  const nextIndex = versions.value.length + 1
  const versionId = `v${nextIndex}`
  const version: FeatureVersion = {
    id: versionId,
    title: versionId,
    createdAt: new Date().toISOString(),
    notes: `From ${activeVersionId.value}`,
  }
  versions.value.push(version)
  // unresolved comments migrate
  const unresolved = comments.value.filter((c) => c.versionId === activeVersionId.value && c.status !== 'resolved')
  for (const c of unresolved) {
    comments.value.push({
      ...c,
      id: `c-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      versionId,
      createdAt: new Date().toISOString(),
      replies: [...c.replies],
    })
  }
  activeVersionId.value = versionId
  await Promise.all([
    writeFeatureVersions(workspacePath.value, productId, screenId, featureId, versions.value),
    persistComments(),
  ])
  toast.success(`Создана версия ${versionId}. Незакрытые комментарии перенесены.`)
}

async function saveDiscussionMd() {
  if (!workspacePath.value || !context.value) {
    toast.error('Нет рабочей папки или контекста фичи')
    return
  }
  const lines: string[] = ['# Discussion\n']
  for (const c of comments.value) {
    lines.push(`## ${c.id} [${c.status}] version=${c.versionId}`)
    lines.push(`Author: ${c.author} | Created: ${c.createdAt}`)
    if (c.resolvedInVersionId) lines.push(`Resolved in: ${c.resolvedInVersionId}`)
    lines.push('')
    lines.push(c.text)
    lines.push('')
  }
  const { productId, screenId, featureId } = context.value
  await writeFeatureFile(workspacePath.value, productId, screenId, featureId, 'discussion.md', lines.join('\n'))
  toast.success('discussion.md сохранён')
}

function countByFilter(f: FilterType) {
  if (f === 'all') return comments.value.length
  if (f === 'open') return comments.value.filter((c) => c.status !== 'resolved').length
  if (f === 'resolved') return comments.value.filter((c) => c.status === 'resolved').length
  return 0
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
        class="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors"
        :class="activeComment && activeComment.status !== 'resolved'
          ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
          : 'cursor-not-allowed text-muted opacity-50'"
        :disabled="!activeComment || activeComment.status === 'resolved'"
        @click="resolveComment"
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
          :class="activeFilter === f
            ? 'bg-accent/15 text-accent'
            : 'text-muted hover:bg-hover hover:text-surface'"
          @click="activeFilter = f as FilterType"
        >
          {{ label }}
        </button>
      </div>
      <div class="h-4 w-px bg-border" />
      <select
        v-model="activeVersionId"
        class="rounded border border-border bg-canvas px-2 py-1 text-xs text-surface"
      >
        <option v-for="v in versions" :key="v.id" :value="v.id">{{ v.title }}</option>
      </select>
      <button
        class="rounded border border-border px-2.5 py-1 text-xs text-surface hover:bg-hover"
        @click="createNewVersion"
      >
        Новая версия
      </button>

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
    <SplitterGroup direction="horizontal" auto-save-id="discussion-layout" class="flex-1 overflow-hidden">
      <!-- Left: Filters -->
      <SplitterPanel :default-size="18" :min-size="12" :max-size="28" class="flex flex-col overflow-hidden border-r border-border bg-panel">
        <ScrollAreaRoot class="flex-1">
          <ScrollAreaViewport class="h-full p-2">
            <div class="mb-3">
              <header class="px-1 py-1.5 text-[11px] uppercase tracking-wider text-muted">Статус</header>
              <div class="flex flex-col gap-0.5">
                <button
                  v-for="(label, f) in { all: 'Все', open: 'Открытые', resolved: 'Решённые' }"
                  :key="f"
                  class="flex items-center justify-between rounded px-2 py-1 text-xs transition-colors"
                  :class="activeFilter === f
                    ? 'bg-hover text-surface'
                    : 'text-muted hover:bg-hover hover:text-surface'"
                  @click="activeFilter = f as FilterType"
                >
                  <span>{{ label }}</span>
                  <span class="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{{ countByFilter(f as FilterType) }}</span>
                </button>
              </div>
            </div>

            <div>
              <header class="px-1 py-1.5 text-[11px] uppercase tracking-wider text-muted">Новый комментарий</header>
              <textarea
                v-model="newCommentText"
                rows="5"
                placeholder="Оставьте комментарий к текущей версии..."
                class="w-full resize-none rounded border border-border bg-canvas px-2 py-1.5 text-xs text-surface outline-none"
              />
              <button
                class="mt-2 w-full rounded border border-border px-2.5 py-1 text-xs text-surface hover:bg-hover"
                @click="addComment"
              >Добавить</button>
            </div>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
            <ScrollAreaThumb class="rounded-full bg-border" />
          </ScrollAreaScrollbar>
        </ScrollAreaRoot>
      </SplitterPanel>

      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
      </SplitterResizeHandle>

      <!-- Center: Version summary -->
      <SplitterPanel :default-size="56" :min-size="30" class="flex flex-col overflow-hidden bg-canvas">
        <div class="flex flex-1 flex-col gap-3 overflow-auto p-6">
          <div class="rounded border border-border/60 bg-panel px-3 py-2">
            <p class="text-xs text-muted">Текущая версия</p>
            <p class="mt-1 text-sm text-surface">{{ currentVersion?.title ?? activeVersionId }}</p>
          </div>
          <button
            v-for="(c, idx) in visibleComments"
            :key="c.id"
            class="rounded border px-3 py-2 text-left"
            :class="activeCommentId === c.id ? 'border-accent bg-accent/5' : 'border-border/50 bg-panel/40'"
            @click="selectComment(c.id)"
          >
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-muted">#{{ idx + 1 }}</span>
              <span class="rounded px-1.5 py-0.5 text-[10px]" :class="c.status === 'resolved' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-hover text-muted'">
                {{ c.status }}
              </span>
              <span class="text-[10px] text-muted">v: {{ c.versionId }}</span>
            </div>
            <p class="mt-1 text-xs text-surface">{{ c.text }}</p>
          </button>
        </div>
      </SplitterPanel>

      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
      </SplitterResizeHandle>

      <!-- Right: Thread -->
      <SplitterPanel :default-size="26" :min-size="18" :max-size="40" class="flex flex-col overflow-hidden border-l border-border bg-panel">
        <!-- Empty state -->
        <div
          v-if="!activeComment"
          class="flex flex-1 flex-col items-center justify-center gap-3 text-muted"
        >
          <icon-lucide-message-circle class="size-8 opacity-30" />
          <p class="text-center text-xs px-4">Выберите комментарий на канвасе</p>
        </div>

        <!-- Thread -->
        <template v-else>
          <!-- Thread header -->
          <div class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
              {{ activeComment.id }}
            </span>
            <span class="flex-1 truncate text-xs text-surface">{{ activeComment.author }}</span>
            <span class="text-[10px] text-muted">{{ new Date(activeComment.createdAt).toLocaleString('ru') }}</span>
            <Tip label="Отметить как решённый">
              <button
                class="flex size-6 items-center justify-center rounded transition-colors"
                :class="activeComment.status === 'resolved'
                  ? 'text-emerald-400 hover:bg-hover'
                  : 'text-muted hover:bg-hover hover:text-emerald-400'"
                @click="resolveComment"
              >
                <icon-lucide-check-circle class="size-3.5" />
              </button>
            </Tip>
          </div>

          <!-- Messages -->
          <ScrollAreaRoot class="min-h-0 flex-1">
            <ScrollAreaViewport class="h-full p-3">
              <div class="flex flex-col gap-3">
                <!-- Original comment -->
                <div class="flex gap-2">
                  <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/20 text-[10px] font-bold text-muted">
                    {{ activeComment.author.slice(0, 2).toUpperCase() }}
                  </span>
                  <div>
                    <div class="flex items-baseline gap-1.5">
                      <span class="text-[11px] font-medium text-surface">{{ activeComment.author }}</span>
                      <span class="text-[10px] text-muted">{{ new Date(activeComment.createdAt).toLocaleString('ru') }}</span>
                    </div>
                    <p class="mt-0.5 text-xs leading-relaxed text-surface/80">{{ activeComment.text }}</p>
                  </div>
                </div>

                <!-- Replies -->
                <div
                  v-for="reply in activeComment.replies"
                  :key="reply.id"
                  class="flex gap-2"
                >
                  <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/20 text-[10px] font-bold text-muted">
                    {{ reply.author.slice(0, 2).toUpperCase() }}
                  </span>
                  <div>
                    <div class="flex items-baseline gap-1.5">
                      <span class="text-[11px] font-medium text-surface">{{ reply.author }}</span>
                      <span class="text-[10px] text-muted">{{ new Date(reply.createdAt).toLocaleString('ru') }}</span>
                    </div>
                    <p class="mt-0.5 text-xs leading-relaxed text-surface/80">{{ reply.text }}</p>
                  </div>
                </div>
              </div>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
              <ScrollAreaThumb class="rounded-full bg-border" />
            </ScrollAreaScrollbar>
          </ScrollAreaRoot>

          <!-- Reply input -->
          <div class="shrink-0 border-t border-border p-2">
            <div class="flex gap-2 rounded-lg border border-border bg-canvas px-2 py-1.5 focus-within:border-accent/50">
              <textarea
                v-model="replyText"
                rows="2"
                placeholder="Ответить…"
                class="flex-1 resize-none bg-transparent text-xs text-surface outline-none placeholder:text-muted"
                @keydown.enter.exact.prevent="sendReply"
              />
              <button
                class="flex size-6 shrink-0 items-center justify-center self-end rounded text-muted transition-colors hover:bg-hover hover:text-surface"
                :class="replyText.trim() ? 'text-accent hover:text-accent' : ''"
                @click="sendReply"
              >
                <icon-lucide-send class="size-3.5" />
              </button>
            </div>
            <p class="mt-1 text-[10px] text-muted">Enter — отправить</p>
          </div>
        </template>
      </SplitterPanel>
    </SplitterGroup>
  </div>
</template>
