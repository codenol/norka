<script setup lang="ts">
import { Chat } from '@ai-sdk/vue'
import { DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import { computed, nextTick, ref, watch } from 'vue'
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
import { createModel, useAIChat } from '@/composables/use-chat'
import { useSettingsDialog } from '@/composables/use-settings-dialog'
import { useProjects } from '@/composables/use-projects'
import { workspacePath, readProjectMd, readScreenMd, writeFeatureFile } from '@/composables/use-workspace-fs'
import { useAnalyticsDesign, ANALYTICS_DESIGN_INSTRUCTIONS } from '@/composables/use-analytics-design'

import type { UIMessage } from 'ai'

// ── Types ─────────────────────────────────────────────────────────────────────

type Skill = 'Discovery' | 'PRD' | 'User Story' | 'Spec'

interface DocSection {
  id: string
  title: string
  content: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SKILLS: Skill[] = ['Discovery', 'PRD', 'User Story', 'Spec']

const SKILL_GREETINGS: Record<Skill, string> = {
  Discovery: 'Привет! Я помогу провести Discovery-сессию. Расскажите — какую задачу или проблему мы исследуем сегодня?',
  PRD: 'Давайте напишем PRD. Какой продукт или фичу мы описываем?',
  'User Story': 'Начнём со User Stories. Для какого продукта или модуля пишем?',
  Spec: 'Готов помочь с технической спецификацией. Что именно нужно описать?',
}

const SKILL_PROMPTS: Record<Skill, string> = {
  Discovery: `Ты — UX-исследователь и продуктовый аналитик. Твоя задача — провести сессию Discovery: задавать чёткие, сфокусированные вопросы, чтобы понять задачу, пользователей, их боли и цели. Задавай по одному вопросу за раз. Будь кратким. Отвечай на русском языке.`,
  PRD: `Ты — продуктовый менеджер. Помоги написать PRD через диалог: узнавай о целях, пользователях, требованиях. Задавай по одному вопросу за раз. Отвечай на русском языке.`,
  'User Story': `Ты — agile-коуч. Помоги написать User Stories через диалог: выясни роли, задачи, ценности. Формат: «Как [роль], я хочу [действие], чтобы [ценность]». По одному вопросу за раз. Отвечай на русском языке.`,
  Spec: `Ты — технический аналитик. Помоги написать техническую спецификацию через диалог: узнай об архитектуре, API, ограничениях. По одному вопросу за раз. Отвечай на русском языке.`,
}

const SKILL_SECTIONS: Record<Skill, string[]> = {
  Discovery: ['Описание задачи', 'Пользователи', 'Боли и потребности', 'Цели', 'Ограничения'],
  PRD: ['Описание', 'Цели', 'Пользователи', 'Функциональные требования', 'Нефункциональные требования'],
  'User Story': ['Контекст', 'User Stories', 'Acceptance Criteria', 'Out of Scope'],
  Spec: ['Описание', 'Архитектура', 'API', 'Ограничения', 'Интеграции'],
}

// ── Mock sidebar sessions (examples only, read-only) ──────────────────────────

interface MockSession {
  id: string
  title: string
  skill: Skill
  date: string
}

const MOCK_SESSIONS: MockSession[] = [
  { id: 'mock-1', title: 'Онбординг пользователей', skill: 'Discovery', date: '12 апр' },
  { id: 'mock-2', title: 'Платёжный флоу', skill: 'PRD', date: '11 апр' },
  { id: 'mock-3', title: 'Дашборд аналитики', skill: 'User Story', date: '10 апр' },
]

// ── AI Chat state ──────────────────────────────────────────────────────────────

const { isConfigured, providerID, maxOutputTokens } = useAIChat()
const settings = useSettingsDialog()
const { context: projectContext } = useProjects()
const { createAnalyticsTools } = useAnalyticsDesign()

/** Build system prompt enriched with project/screen context from disk */
async function buildSystemPrompt(skill: Skill): Promise<string> {
  const base = SKILL_PROMPTS[skill]
  if (!workspacePath.value || !projectContext.value) return base

  const { productId, screenId } = projectContext.value
  const [projectMd, screenMd] = await Promise.all([
    readProjectMd(workspacePath.value, productId),
    readScreenMd(workspacePath.value, productId, screenId),
  ])

  const parts = [base]
  if (projectMd) parts.push(`\n\n# Контекст продукта\n${projectMd}`)
  if (screenMd)  parts.push(`\n\n# Контекст экрана\n${screenMd}`)
  return parts.join('')
}

const activeSkill = ref<Skill>('Discovery')
const skillMenuOpen = ref(false)
const inputText = ref('')
const messagesEndRef = ref<HTMLDivElement>()
const chatInst = ref<Chat<UIMessage> | null>(null)
const isGeneratingDoc = ref(false)
const generatedDoc = ref<DocSection[]>([])
const expandedSections = ref<Set<string>>(new Set())

// Reactive messages from the Chat instance
const chatMessages = ref<UIMessage[]>([])

// Chat status (streaming / ready / error)
const chatStatus = ref<string>('ready')

function makeGreeting(skill: Skill): UIMessage {
  return {
    id: 'init-greeting',
    role: 'assistant',
    content: SKILL_GREETINGS[skill],
    parts: [{ type: 'text', text: SKILL_GREETINGS[skill] }],
  } as UIMessage
}

async function createChat(skill: Skill): Promise<Chat<UIMessage>> {
  const isLMStudio = providerID.value === 'lm-studio'
  const baseInstructions = await buildSystemPrompt(skill)
  // Append design tool instructions so AI knows it can assemble mockups
  const instructions = `${baseInstructions}\n\n${ANALYTICS_DESIGN_INSTRUCTIONS}`
  const agent = new ToolLoopAgent({
    model: createModel(),
    instructions,
    tools: createAnalyticsTools(),
    stopWhen: stepCountIs(25),  // increased to allow multi-step mockup assembly
    maxOutputTokens: isLMStudio ? undefined : Math.min(maxOutputTokens.value, 4096),
  })
  const transport = new DirectChatTransport({ agent })
  const inst = new Chat<UIMessage>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transport: transport as any,
    messages: [makeGreeting(skill)],
  })
  return inst
}

async function initChat() {
  if (!isConfigured.value) return
  const inst = await createChat(activeSkill.value)
  chatInst.value = inst
  chatMessages.value = inst.messages
  startStatusWatch(inst)
}

let statusInterval: ReturnType<typeof setInterval> | null = null

function startStatusWatch(inst: Chat<UIMessage>) {
  if (statusInterval) clearInterval(statusInterval)
  statusInterval = setInterval(() => {
    chatStatus.value = inst.status
    // Keep messages in sync — inst.messages is the reactive source of truth
    chatMessages.value = inst.messages
  }, 100)
}

async function resetChat(skill: Skill) {
  if (statusInterval) clearInterval(statusInterval)
  statusInterval = null
  chatInst.value = null
  chatMessages.value = [makeGreeting(skill)]
  chatStatus.value = 'ready'
  generatedDoc.value = []
  expandedSections.value = new Set()
  if (isConfigured.value) {
    const inst = await createChat(skill)
    chatInst.value = inst
    chatMessages.value = inst.messages
    startStatusWatch(inst)
  }
}

// Init on mount if configured
chatMessages.value = [makeGreeting(activeSkill.value)]
if (isConfigured.value) void initChat()

watch(isConfigured, (configured) => {
  if (configured && !chatInst.value) void initChat()
})

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || !isConfigured.value) return
  inputText.value = ''
  if (!chatInst.value) initChat()
  const inst = chatInst.value
  if (!inst) return
  if (inst.status === 'streaming' || inst.status === 'submitted') return
  inst.sendMessage({ text }).catch((e: unknown) => {
    console.error('Analytics chat error:', e)
  })
  await nextTick()
  messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
}

// Auto-scroll when messages change
watch(
  chatMessages,
  () => {
    nextTick(() => messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' }))
  },
  { deep: true },
)

// ── Document generation ────────────────────────────────────────────────────────

function getText(msg: UIMessage): string {
  for (const part of msg.parts ?? []) {
    if ((part as Record<string, unknown>).type === 'text') {
      return (part as { type: string; text: string }).text
    }
  }
  return (msg as unknown as { content?: string }).content ?? ''
}

function waitForReady(inst: Chat<UIMessage>, timeout = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (inst.status === 'ready' || inst.status === 'error') return resolve()
      if (Date.now() - start > timeout) return reject(new Error('Timeout'))
      setTimeout(check, 200)
    }
    check()
  })
}

function parseDocSections(raw: string, skill: Skill): DocSection[] {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON')
    const parsed = JSON.parse(match[0]) as { sections?: { title: string; content: string }[] }
    if (!Array.isArray(parsed.sections)) throw new Error('No sections')
    return parsed.sections.map((s, i) => ({ id: `s${i}`, title: s.title, content: s.content }))
  } catch {
    return SKILL_SECTIONS[skill].map((title, i) => ({
      id: `s${i}`,
      title,
      content: 'Недостаточно данных из диалога.',
    }))
  }
}

async function generateDoc() {
  if (!isConfigured.value) return
  const msgs = chatMessages.value
  if (msgs.length < 2) return

  isGeneratingDoc.value = true
  try {
    const isLMStudio = providerID.value === 'lm-studio'
    const sectionNames = SKILL_SECTIONS[activeSkill.value].join(', ')
    const context = msgs
      .map((m) => `${m.role === 'user' ? 'Пользователь' : 'AI'}: ${getText(m)}`)
      .join('\n')
    const prompt = `Диалог:\n${context}\n\nНа основе этого диалога сформируй документ типа "${activeSkill.value}".
Верни ТОЛЬКО валидный JSON без markdown-блоков:
{"sections":[{"title":"...","content":"..."},...]}
Разделы: ${sectionNames}. Пиши по-русски, кратко.`

    const agent = new ToolLoopAgent({
      model: createModel(),
      stopWhen: stepCountIs(1),
      maxOutputTokens: isLMStudio ? undefined : 2048,
    })
    const transport = new DirectChatTransport({ agent })
    const docChat = new Chat<UIMessage>({ transport, messages: [] })
    await docChat.sendMessage({ text: prompt })
    await waitForReady(docChat)

    const last = docChat.messages.at(-1)
    if (last) {
      generatedDoc.value = parseDocSections(getText(last), activeSkill.value)
      expandedSections.value = new Set(generatedDoc.value.map((s) => s.id))

      // Save analytics.md to disk if workspace is set
      if (workspacePath.value && projectContext.value) {
        const { productId, screenId, featureId } = projectContext.value
        const mdContent = [
          `# ${activeSkill.value}\n`,
          ...generatedDoc.value.map(s => `## ${s.title}\n\n${s.content}`),
        ].join('\n\n')
        writeFeatureFile(
          workspacePath.value, productId, screenId, featureId,
          'analytics.md', mdContent,
        ).catch(console.error)
      }
    }
  } catch (e) {
    console.error('Doc generation error:', e)
  } finally {
    isGeneratingDoc.value = false
  }
}

function toggleSection(id: string) {
  const set = new Set(expandedSections.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  expandedSections.value = set
}

const isStreaming = computed(() => chatStatus.value === 'streaming' || chatStatus.value === 'submitted')
const canSend = computed(() => inputText.value.trim().length > 0 && isConfigured.value && !isStreaming.value)
</script>

<template>
  <div class="flex h-full w-full select-text flex-col overflow-hidden">
    <!-- Top bar -->
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <!-- Skill selector -->
      <div class="relative">
        <button
          class="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs text-surface transition-colors hover:bg-hover"
          @click="skillMenuOpen = !skillMenuOpen"
        >
          <icon-lucide-brain-circuit class="size-3.5 text-accent" />
          {{ activeSkill }}
          <icon-lucide-chevron-down class="size-3 text-muted" />
        </button>
        <div
          v-if="skillMenuOpen"
          class="absolute left-0 top-full z-50 mt-1 min-w-[120px] rounded-lg border border-border bg-panel p-1 shadow-xl"
        >
          <button
            v-for="skill in SKILLS"
            :key="skill"
            class="w-full rounded px-2.5 py-1.5 text-left text-xs transition-colors"
            :class="
              activeSkill === skill
                ? 'bg-accent/15 text-accent'
                : 'text-muted hover:bg-hover hover:text-surface'
            "
            @click="activeSkill = skill; skillMenuOpen = false; resetChat(skill)"
          >
            {{ skill }}
          </button>
        </div>
      </div>

      <div class="h-4 w-px bg-border" />
      <span class="text-xs font-medium text-surface">{{ activeSkill }} — новая сессия</span>
      <div class="flex-1" />

      <button
        class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
        @click="resetChat(activeSkill)"
      >
        <icon-lucide-rotate-ccw class="size-3.5" />
        Сбросить
      </button>
    </header>

    <SplitterGroup direction="horizontal" auto-save-id="analytics-layout" class="flex-1 overflow-hidden">
      <!-- Left: Session list (examples) -->
      <SplitterPanel
        :default-size="18"
        :min-size="14"
        :max-size="28"
        class="flex flex-col overflow-hidden border-r border-border bg-panel"
      >
        <header class="shrink-0 px-3 py-2 text-[11px] uppercase tracking-wider text-muted">
          Примеры
        </header>
        <ScrollAreaRoot class="flex-1">
          <ScrollAreaViewport class="h-full px-2 pb-2">
            <div class="flex flex-col gap-0.5">
              <div
                v-for="session in MOCK_SESSIONS"
                :key="session.id"
                class="flex flex-col gap-0.5 rounded-lg px-2 py-2 text-muted"
              >
                <div class="flex items-center gap-1.5">
                  <icon-lucide-message-square class="size-3 shrink-0 text-accent/50" />
                  <span class="truncate text-[11px] font-medium">{{ session.title }}</span>
                </div>
                <div class="flex items-center gap-1.5 pl-4.5">
                  <span class="rounded bg-muted/10 px-1.5 py-0.5 text-[10px]">{{ session.skill }}</span>
                  <span class="text-[10px]">{{ session.date }}</span>
                </div>
              </div>
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

      <!-- Center: Chat -->
      <SplitterPanel :default-size="50" :min-size="30" class="flex flex-col overflow-hidden bg-canvas">
        <!-- AI not configured banner -->
        <div
          v-if="!isConfigured"
          class="m-4 flex flex-col items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center"
        >
          <icon-lucide-bot class="size-8 text-amber-400" />
          <p class="text-sm font-medium text-surface">Нужно настроить AI</p>
          <p class="text-xs text-muted">
            Настройте подключение к AI-провайдеру, чтобы начать диалог с ассистентом.
          </p>
          <button
            class="mt-1 flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent/80"
            @click="settings.show()"
          >
            <icon-lucide-settings class="size-3.5" />
            Настроить AI
          </button>
        </div>

        <!-- Messages -->
        <ScrollAreaRoot class="flex-1">
          <ScrollAreaViewport class="h-full px-4 py-4">
            <div class="flex flex-col gap-4">
              <div
                v-for="msg in chatMessages"
                :key="msg.id"
                class="flex gap-3"
                :class="msg.role === 'user' ? 'flex-row-reverse' : ''"
              >
                <!-- Avatar -->
                <div
                  class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  :class="
                    msg.role === 'assistant' ? 'bg-accent/20 text-accent' : 'bg-muted/20 text-muted'
                  "
                >
                  {{ msg.role === 'assistant' ? 'AI' : 'Я' }}
                </div>

                <!-- Bubble -->
                <div
                  class="max-w-[75%] rounded-2xl px-4 py-2.5"
                  :class="
                    msg.role === 'assistant'
                      ? 'rounded-tl-sm bg-panel text-surface'
                      : 'rounded-tr-sm bg-accent/15 text-surface'
                  "
                >
                  <p class="whitespace-pre-wrap text-sm leading-relaxed">{{ getText(msg) }}</p>
                </div>
              </div>

              <!-- Streaming indicator -->
              <div v-if="isStreaming" class="flex gap-3">
                <div
                  class="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent"
                >
                  AI
                </div>
                <div class="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-panel px-4 py-3">
                  <span class="size-1.5 animate-bounce rounded-full bg-accent/60 [animation-delay:0ms]" />
                  <span class="size-1.5 animate-bounce rounded-full bg-accent/60 [animation-delay:150ms]" />
                  <span class="size-1.5 animate-bounce rounded-full bg-accent/60 [animation-delay:300ms]" />
                </div>
              </div>

              <div ref="messagesEndRef" />
            </div>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
            <ScrollAreaThumb class="rounded-full bg-border" />
          </ScrollAreaScrollbar>
        </ScrollAreaRoot>

        <!-- Input -->
        <div class="shrink-0 border-t border-border p-3">
          <div
            class="flex items-end gap-2 rounded-xl border border-border bg-panel px-3 py-2 transition-colors focus-within:border-accent/50"
          >
            <textarea
              v-model="inputText"
              rows="2"
              :disabled="!isConfigured || isStreaming"
              :placeholder="isConfigured ? 'Ответьте на вопрос AI…' : 'Сначала настройте AI'"
              class="flex-1 resize-none bg-transparent text-sm text-surface outline-none placeholder:text-muted disabled:opacity-50"
              @keydown.enter.exact.prevent="sendMessage"
            />
            <button
              :disabled="!canSend"
              class="flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed"
              :class="canSend ? 'bg-accent text-white hover:bg-accent/80' : 'bg-hover text-muted'"
              @click="sendMessage"
            >
              <icon-lucide-arrow-up class="size-4" />
            </button>
          </div>
          <p class="mt-1 text-[10px] text-muted">Enter — отправить · Shift+Enter — новая строка</p>
        </div>
      </SplitterPanel>

      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
      </SplitterResizeHandle>

      <!-- Right: Generated document -->
      <SplitterPanel
        :default-size="32"
        :min-size="22"
        :max-size="45"
        class="flex flex-col overflow-hidden border-l border-border bg-panel"
      >
        <div class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <icon-lucide-file-text class="size-3.5 shrink-0 text-accent" />
          <span class="flex-1 text-xs font-medium text-surface">{{ activeSkill }}</span>
          <Tip label="Скопировать">
            <button
              v-if="generatedDoc.length > 0"
              class="flex size-6 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="
                navigator.clipboard.writeText(
                  generatedDoc.map((s) => `## ${s.title}\n${s.content}`).join('\n\n'),
                )
              "
            >
              <icon-lucide-copy class="size-3.5" />
            </button>
          </Tip>
        </div>

        <!-- Empty state -->
        <div
          v-if="generatedDoc.length === 0 && !isGeneratingDoc"
          class="flex flex-1 flex-col items-center justify-center gap-4 p-4"
        >
          <icon-lucide-file-text class="size-8 text-muted opacity-30" />
          <div class="text-center">
            <p class="text-xs text-muted">Пообщайтесь с AI, затем нажмите кнопку ниже.</p>
          </div>
          <button
            :disabled="!isConfigured || chatMessages.length < 2"
            class="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-surface transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
            @click="generateDoc"
          >
            <icon-lucide-sparkles class="size-3.5 text-accent" />
            Сформировать документ
          </button>
        </div>

        <!-- Generating indicator -->
        <div v-else-if="isGeneratingDoc" class="flex flex-1 flex-col items-center justify-center gap-3">
          <icon-lucide-loader-circle class="size-6 animate-spin text-accent" />
          <p class="text-xs text-muted">Генерирую документ…</p>
        </div>

        <!-- Document sections -->
        <template v-else>
          <ScrollAreaRoot class="flex-1">
            <ScrollAreaViewport class="h-full p-3">
              <div class="flex flex-col gap-1">
                <div
                  v-for="section in generatedDoc"
                  :key="section.id"
                  class="overflow-hidden rounded-lg border border-border transition-colors hover:border-border/80"
                >
                  <button
                    class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-hover/50"
                    :class="expandedSections.has(section.id) ? 'bg-hover/30' : ''"
                    @click="toggleSection(section.id)"
                  >
                    <icon-lucide-chevron-right
                      class="size-3 shrink-0 text-muted transition-transform"
                      :class="expandedSections.has(section.id) ? 'rotate-90' : ''"
                    />
                    <span class="text-xs font-medium text-surface">{{ section.title }}</span>
                  </button>
                  <div
                    v-if="expandedSections.has(section.id)"
                    class="border-t border-border bg-canvas/50 px-3 py-2"
                  >
                    <p class="whitespace-pre-wrap text-xs leading-relaxed text-surface/80">
                      {{ section.content }}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
              <ScrollAreaThumb class="rounded-full bg-border" />
            </ScrollAreaScrollbar>
          </ScrollAreaRoot>

          <!-- Regenerate button -->
          <div class="shrink-0 border-t border-border p-2">
            <button
              :disabled="isGeneratingDoc"
              class="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface disabled:opacity-40"
              @click="generateDoc"
            >
              <icon-lucide-refresh-cw class="size-3.5" />
              Перегенерировать
            </button>
          </div>
        </template>
      </SplitterPanel>
    </SplitterGroup>
  </div>
</template>
