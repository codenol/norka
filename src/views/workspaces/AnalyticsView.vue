<script setup lang="ts">
import { Chat } from '@ai-sdk/vue'
import { DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
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
import { readAllComponentRules, readFeatureFile } from '@/composables/use-workspace-fs'

import type { UIMessage } from 'ai'

// ── Brief sections ─────────────────────────────────────────────────────────────

const BRIEF_SECTIONS = [
  { id: 'task',        title: 'Задача' },
  { id: 'users',       title: 'Пользователь' },
  { id: 'scenarios',   title: 'Сценарии' },
  { id: 'states',      title: 'Состояния' },
  { id: 'constraints', title: 'Ограничения' },
  { id: 'metrics',     title: 'Метрики' },
  { id: 'questions',   title: 'Открытые вопросы' },
] as const

type BriefSectionId = (typeof BRIEF_SECTIONS)[number]['id']

const briefContent = ref<Record<BriefSectionId, string>>({
  task:        '',
  users:       '',
  scenarios:   '',
  states:      '',
  constraints: '',
  metrics:     '',
  questions:   '',
})

function parseBriefMd(md: string) {
  for (const section of BRIEF_SECTIONS) {
    const regex = new RegExp(`## ${section.title}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
    const match = md.match(regex)
    if (match) briefContent.value[section.id] = match[1].trim()
  }
}

function briefToMd(): string {
  const lines = ['# Аналитика\n']
  for (const s of BRIEF_SECTIONS) {
    lines.push(`## ${s.title}\n\n${briefContent.value[s.id]}\n`)
  }
  return lines.join('\n')
}

// ── Workspace & context ───────────────────────────────────────────────────────

const { isConfigured, providerID, maxOutputTokens } = useAIChat()
const settings = useSettingsDialog()
const { context: projectContext } = useProjects()
const { createAnalyticsTools } = useAnalyticsDesign()

async function buildSystemPrompt(): Promise<string> {
  const base = `Ты — продуктовый аналитик и UX-исследователь. Помоги дизайнеру собрать аналитический бриф для фичи.

Бриф состоит из 7 разделов:
- Задача: что нужно решить, зачем это пользователю и бизнесу
- Пользователь: кто использует, его контекст, потребности, боли
- Сценарии: основные пользовательские сценарии (numbered list)
- Состояния: все состояния экрана/фичи — пустое, загрузка, успех, ошибка, крайние случаи
- Ограничения: технические, бизнесовые, временны́е
- Метрики: как измерить успех дизайна/фичи
- Открытые вопросы: что ещё нужно уточнить перед проектированием

Веди диалог: задавай уточняющие вопросы по одному. Будь кратким. Отвечай на русском языке.`

  if (!workspacePath.value || !projectContext.value) return base

  const { productId, screenId } = projectContext.value
  const [projectMd, screenMd] = await Promise.all([
    readProjectMd(workspacePath.value, productId),
    readScreenMd(workspacePath.value, productId, screenId),
  ])

  const [rules] = await Promise.all([
    readAllComponentRules(workspacePath.value),
  ])

  const parts = [base]
  if (projectMd) parts.push(`\n\n# Контекст продукта\n${projectMd}`)
  if (screenMd)  parts.push(`\n\n# Контекст экрана\n${screenMd}`)
  if (rules)     parts.push(`\n\n# Правила компонентов дизайн-системы\n${rules}`)
  return parts.join('')
}

// ── Load brief on mount ───────────────────────────────────────────────────────

onMounted(async () => {
  if (!workspacePath.value || !projectContext.value) return
  const { productId, screenId, featureId } = projectContext.value
  try {
    const md = await readFeatureFile(workspacePath.value, productId, screenId, featureId, 'analytics.md')
    if (md) parseBriefMd(md)
  } catch {
    // file may not exist yet — that's fine
  }
})

// ── Auto-save brief ───────────────────────────────────────────────────────────

const savingBrief = ref(false)
const briefDirty = ref(false)
const lastSaved = ref(false) // true = ever saved this session

async function saveBrief() {
  if (!workspacePath.value || !projectContext.value) return
  savingBrief.value = true
  try {
    const { productId, screenId, featureId } = projectContext.value
    await writeFeatureFile(
      workspacePath.value, productId, screenId, featureId,
      'analytics.md', briefToMd(),
    )
    lastSaved.value = true
    briefDirty.value = false
  } catch (e) {
    console.error('Save brief error:', e)
  } finally {
    savingBrief.value = false
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

watch(briefContent, () => {
  briefDirty.value = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveBrief(), 1500)
}, { deep: true })

const saveStatusLabel = computed(() => {
  if (savingBrief.value) return 'Сохраняю…'
  if (briefDirty.value) return 'Не сохранено'
  if (lastSaved.value) return 'Сохранено'
  return null
})

// ── AI Chat ───────────────────────────────────────────────────────────────────

const GREETING = 'Привет! Я помогу составить аналитический бриф для этой фичи. Расскажите — какую задачу или проблему мы решаем?'

function makeGreeting(): UIMessage {
  return {
    id: 'init-greeting',
    role: 'assistant',
    content: GREETING,
    parts: [{ type: 'text', text: GREETING }],
  } as UIMessage
}

const inputText = ref('')
const messagesEndRef = ref<HTMLDivElement>()
const chatInst = ref<Chat<UIMessage> | null>(null)
const chatMessages = ref<UIMessage[]>([makeGreeting()])
const chatStatus = ref<string>('ready')

async function createChat(): Promise<Chat<UIMessage>> {
  const isLMStudio = providerID.value === 'lm-studio'
  const baseInstructions = await buildSystemPrompt()
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
  return new Chat<UIMessage>({ transport, messages: [makeGreeting()] })
}

let statusInterval: ReturnType<typeof setInterval> | null = null

function startStatusWatch(inst: Chat<UIMessage>) {
  if (statusInterval) clearInterval(statusInterval)
  statusInterval = setInterval(() => {
    chatStatus.value = inst.status
    chatMessages.value = inst.messages
  }, 100)
}

async function initChat() {
  if (!isConfigured.value) return
  const inst = await createChat()
  chatInst.value = inst
  chatMessages.value = inst.messages
  startStatusWatch(inst)
}

async function resetChat() {
  if (statusInterval) clearInterval(statusInterval)
  statusInterval = null
  chatInst.value = null
  chatMessages.value = [makeGreeting()]
  chatStatus.value = 'ready'
  if (isConfigured.value) {
    const inst = await createChat()
    chatInst.value = inst
    chatMessages.value = inst.messages
    startStatusWatch(inst)
  }
}

onUnmounted(() => {
  if (statusInterval) clearInterval(statusInterval)
  if (saveTimer) clearTimeout(saveTimer)
})

if (isConfigured.value) void initChat()

watch(isConfigured, (configured) => {
  if (configured && !chatInst.value) void initChat()
})

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || !isConfigured.value) return
  inputText.value = ''
  if (!chatInst.value) void initChat()
  const inst = chatInst.value
  if (!inst) return
  if (inst.status === 'streaming' || inst.status === 'submitted') return
  inst.sendMessage({ text }).catch((e: unknown) => {
    console.error('Analytics chat error:', e)
  })
  await nextTick()
  messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
}

watch(
  chatMessages,
  () => { nextTick(() => messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })) },
  { deep: true },
)

// ── Update brief from chat ────────────────────────────────────────────────────

const isUpdatingBrief = ref(false)

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

async function updateBriefFromChat() {
  if (!isConfigured.value || chatMessages.value.length < 2) return
  isUpdatingBrief.value = true
  try {
    const isLMStudio = providerID.value === 'lm-studio'
    const context = chatMessages.value
      .map(m => `${m.role === 'user' ? 'Пользователь' : 'AI'}: ${getText(m)}`)
      .join('\n')

    const currentBrief = BRIEF_SECTIONS
      .map(s => `## ${s.title}\n${briefContent.value[s.id] || '(пусто)'}`)
      .join('\n\n')

    const prompt =
      `Диалог:\n${context}\n\nТекущий бриф:\n${currentBrief}\n\n` +
      `На основе диалога обнови бриф. Заполни все разделы, которые можно вывести из диалога. ` +
      `Для разделов без данных оставь пустую строку. ` +
      `Верни ТОЛЬКО валидный JSON без markdown-блоков:\n` +
      `{"task":"...","users":"...","scenarios":"...","states":"...","constraints":"...","metrics":"...","questions":"..."}\n` +
      `Пиши по-русски, кратко и по существу.`

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
      const raw = getText(last)
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0]) as Record<string, string>
        for (const s of BRIEF_SECTIONS) {
          if (parsed[s.id]?.trim()) {
            briefContent.value[s.id] = parsed[s.id]
          }
        }
      }
    }
  } catch (e) {
    console.error('Update brief error:', e)
  } finally {
    isUpdatingBrief.value = false
  }
}

const isStreaming = computed(() => chatStatus.value === 'streaming' || chatStatus.value === 'submitted')
const canSend = computed(() => inputText.value.trim().length > 0 && isConfigured.value && !isStreaming.value)
</script>

<template>
  <div class="flex h-full w-full select-text flex-col overflow-hidden">
    <!-- Top bar -->
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <icon-lucide-brain-circuit class="size-3.5 text-accent" />
      <span class="text-xs font-medium text-surface">Аналитика</span>

      <div class="h-4 w-px bg-border" />

      <button
        :disabled="!isConfigured || chatMessages.length < 2 || isUpdatingBrief"
        class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs transition-colors hover:bg-hover hover:text-surface disabled:cursor-not-allowed disabled:opacity-40"
        :class="isUpdatingBrief ? 'text-accent' : 'text-muted'"
        @click="updateBriefFromChat"
      >
        <icon-lucide-loader-circle v-if="isUpdatingBrief" class="size-3.5 animate-spin" />
        <icon-lucide-sparkles v-else class="size-3.5" />
        {{ isUpdatingBrief ? 'Обновляю…' : 'Обновить бриф' }}
      </button>

      <div class="flex-1" />

      <span v-if="saveStatusLabel" class="text-[10px] text-muted">{{ saveStatusLabel }}</span>

      <div class="h-4 w-px bg-border" />

      <button
        class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
        @click="resetChat"
      >
        <icon-lucide-rotate-ccw class="size-3.5" />
        Сбросить чат
      </button>
    </header>

    <SplitterGroup direction="horizontal" auto-save-id="analytics-layout" class="flex-1 overflow-hidden">
      <!-- Left: Chat -->
      <SplitterPanel :default-size="55" :min-size="35" class="flex flex-col overflow-hidden bg-canvas">
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
                <div
                  class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  :class="msg.role === 'assistant' ? 'bg-accent/20 text-accent' : 'bg-muted/20 text-muted'"
                >
                  {{ msg.role === 'assistant' ? 'AI' : 'Я' }}
                </div>
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
                <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
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
          <div class="flex items-end gap-2 rounded-xl border border-border bg-panel px-3 py-2 transition-colors focus-within:border-accent/50">
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

      <!-- Right: Brief editor -->
      <SplitterPanel
        :default-size="45"
        :min-size="28"
        :max-size="60"
        class="flex flex-col overflow-hidden border-l border-border"
      >
        <!-- Panel header -->
        <div class="flex shrink-0 items-center gap-2 border-b border-border bg-panel px-3 py-2">
          <icon-lucide-file-text class="size-3.5 shrink-0 text-accent" />
          <span class="flex-1 text-xs font-medium text-surface">analytics.md</span>
          <Tip label="Скопировать markdown">
            <button
              class="flex size-6 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="navigator.clipboard.writeText(briefToMd())"
            >
              <icon-lucide-copy class="size-3.5" />
            </button>
          </Tip>
          <Tip label="Сохранить на диск">
            <button
              :disabled="savingBrief"
              class="flex size-6 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface disabled:opacity-40"
              @click="saveBrief"
            >
              <icon-lucide-save class="size-3.5" />
            </button>
          </Tip>
        </div>

        <!-- Sections -->
        <ScrollAreaRoot class="flex-1 bg-canvas">
          <ScrollAreaViewport class="h-full">
            <div class="flex flex-col divide-y divide-border/60">
              <div
                v-for="section in BRIEF_SECTIONS"
                :key="section.id"
                class="flex flex-col"
              >
                <div class="bg-panel/60 px-3 py-1.5">
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {{ section.title }}
                  </span>
                </div>
                <textarea
                  v-model="briefContent[section.id]"
                  :placeholder="`${section.title}…`"
                  class="min-h-[72px] resize-none bg-canvas px-3 py-2.5 text-sm leading-relaxed text-surface outline-none placeholder:text-muted/40 focus:bg-hover/20"
                  style="field-sizing: content"
                />
              </div>
            </div>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
            <ScrollAreaThumb class="rounded-full bg-border" />
          </ScrollAreaScrollbar>
        </ScrollAreaRoot>
      </SplitterPanel>
    </SplitterGroup>
  </div>
</template>
