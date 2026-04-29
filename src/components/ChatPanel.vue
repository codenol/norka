<script setup lang="ts">
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { computed, markRaw, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { didHitStepLimit } from '@/ai/tools'
import { injectProtoStore } from '@/composables/use-proto-store'
import { buildAnalyticsFeatureAnalysisPrompt, IS_BROWSER } from '@/constants'
import { activeTab } from '@/stores/tabs'
import ACPPermissionDialog from '@/components/chat/ACPPermissionDialog.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import ProviderSetup from '@/components/chat/ProviderSetup.vue'
import { useAIChat } from '@/composables/use-chat'
import { useProjects } from '@/composables/use-projects'
import { toast } from '@/utils/toast'

import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'
import type { PropType } from 'vue'

type CanvasTarget = 'editor' | 'proto' | 'analytics'
const { canvasTarget, onImportStructuredAnalytics, isStructuredAnalyticsMessageImported } = defineProps({
  canvasTarget: { type: String as PropType<CanvasTarget>, required: false },
  onImportStructuredAnalytics: {
    type: Function as PropType<(message: UIMessage) => void>,
    required: false
  },
  isStructuredAnalyticsMessageImported: {
    type: Function as PropType<(messageId: string) => boolean>,
    required: false
  }
})
const injectedProtoStore = injectProtoStore()
const isAnalyticsRoute = computed(() => {
  if (!IS_BROWSER) return false
  return window.location.pathname.includes('/analytics')
})
const effectiveTarget = computed<CanvasTarget>(() => {
  if (canvasTarget) return canvasTarget
  if (isAnalyticsRoute.value) return 'analytics'
  return injectedProtoStore ? 'proto' : 'editor'
})
const protoStore = computed(() =>
  effectiveTarget.value === 'proto' ? (injectedProtoStore ?? undefined) : undefined
)
const isAnalyticsMode = computed(
  () => effectiveTarget.value === 'analytics' || isAnalyticsRoute.value
)
const PENDING_PROMPT_KEY_BY_TARGET: Record<CanvasTarget, string> = {
  editor: 'norka:pending-editor-prompt',
  proto: 'norka:pending-design-prompt',
  analytics: 'norka:pending-analytics-prompt'
}
const PENDING_PROMPT_EVENT_BY_TARGET: Record<CanvasTarget, string> = {
  editor: 'norka:pending-editor-prompt:updated',
  proto: 'norka:pending-design-prompt:updated',
  analytics: 'norka:pending-analytics-prompt:updated'
}

const { isConfigured, ensureChat, stopAndRecreateChat, protoDesignMode, chatSessions, getChatScopeKeyForTarget } =
  useAIChat()
const { currentProduct, currentScreen, currentFeature } = useProjects()

const chat = ref<Chat<UIMessage> | null>(null)

ensureChat(effectiveTarget.value, { protoStore: protoStore.value }).then((c) => {
  if (c) chat.value = markRaw(c)
})
const messagesEnd = ref<HTMLDivElement>()

const messages = computed(() => chat.value?.messages ?? [])
const status = computed(() => chat.value?.status ?? 'ready')
const isThinking = computed(() => {
  const s = status.value
  if (s !== 'submitted' && s !== 'streaming') return false
  if (messages.value.length === 0) return true
  const last = messages.value[messages.value.length - 1]
  if (last.role !== 'assistant') return true
  const parts = last.parts
  if (parts.length === 0) return true
  const lastPart = parts[parts.length - 1] as Record<string, unknown>
  if (lastPart.type === 'step-start') return true
  if ('toolCallId' in lastPart && lastPart.state === 'output-available') return true
  if ('toolCallId' in lastPart && lastPart.state === 'output-error') return true
  return s === 'submitted'
})

const showContinue = computed(() => {
  if (isAnalyticsMode.value) return false
  if (status.value !== 'ready') return false
  if (messages.value.length === 0) return false
  const last = messages.value[messages.value.length - 1]
  return last.role === 'assistant' && didHitStepLimit()
})
const THINKING_OPENERS = [
  'Думаю',
  'Размышляю',
  'Прикидываю',
  'Сверяю идеи',
  'Собираю мысли',
  'Кручу варианты',
  'Шуршу нейронами',
  'Проверяю гипотезы',
  'Ищу красивый ход',
  'Склеиваю логику'
] as const

const THINKING_STYLE = [
  'но не сильно',
  'без фанатизма',
  'как умею',
  'на минималках',
  'с энтузиазмом стажера',
  'под бодрый внутренний саундтрек',
  'с очень серьезным видом',
  'по заветам дедлайна',
  'не идеально, зато честно',
  'как будто знаю, что делаю'
] as const

const THINKING_ENDINGS = [
  'зато старательно',
  'зато с огоньком',
  'зато очень стараюсь',
  'зато почти как профессионал',
  'зато с любовью к деталям',
  'зато с верой в лучшее',
  'зато без паники',
  'зато с уважением к пикселям',
  'зато аккуратно',
  'зато уже близко'
] as const

const THINKING_POSTFIX = [
  'Секундочку…',
  'Почти готово…',
  'Финальный штрих…',
  'Ща приду с ответом…',
  'Немного магии…'
] as const

function buildThinkingPhrases(limit = 500): string[] {
  const phrases: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < limit * 2 && phrases.length < limit; i += 1) {
    const opener = THINKING_OPENERS[i % THINKING_OPENERS.length]
    const style = THINKING_STYLE[(i * 3 + 1) % THINKING_STYLE.length]
    const ending = THINKING_ENDINGS[(i * 5 + 2) % THINKING_ENDINGS.length]
    const postfix = THINKING_POSTFIX[(i * 7 + 3) % THINKING_POSTFIX.length]
    const phrase = `${opener}, ${style}, ${ending}. ${postfix}`
    if (seen.has(phrase)) continue
    seen.add(phrase)
    phrases.push(phrase)
  }
  return phrases.slice(0, limit)
}

const THINKING_PHRASES = buildThinkingPhrases(500)
const animatedThinkingText = ref('')
let loaderTickTimer: ReturnType<typeof setTimeout> | null = null
let loaderPhraseIndex = 0
let loaderCharIndex = 0
let loaderIsDeleting = false

function clearLoaderTimer() {
  if (!loaderTickTimer) return
  clearTimeout(loaderTickTimer)
  loaderTickTimer = null
}

function scheduleLoaderTick(delayMs: number) {
  loaderTickTimer = setTimeout(runLoaderTick, delayMs)
}

function runLoaderTick() {
  if (!isThinking.value) return
  const phrase = THINKING_PHRASES[loaderPhraseIndex % THINKING_PHRASES.length] ?? 'Думаю…'
  if (!loaderIsDeleting) {
    loaderCharIndex = Math.min(loaderCharIndex + 1, phrase.length)
    animatedThinkingText.value = phrase.slice(0, loaderCharIndex)
    if (loaderCharIndex >= phrase.length) {
      loaderIsDeleting = true
      scheduleLoaderTick(600)
      return
    }
    scheduleLoaderTick(24)
    return
  }

  loaderCharIndex = Math.max(loaderCharIndex - 1, 0)
  animatedThinkingText.value = phrase.slice(0, loaderCharIndex)
  if (loaderCharIndex <= 0) {
    loaderIsDeleting = false
    loaderPhraseIndex = (loaderPhraseIndex + 1) % THINKING_PHRASES.length
    scheduleLoaderTick(140)
    return
  }
  scheduleLoaderTick(14)
}

function startThinkingLoader() {
  clearLoaderTimer()
  if (!isThinking.value) return
  const phrase = THINKING_PHRASES[loaderPhraseIndex % THINKING_PHRASES.length] ?? 'Думаю…'
  loaderIsDeleting = false
  loaderCharIndex = Math.min(loaderCharIndex, phrase.length)
  animatedThinkingText.value = phrase.slice(0, loaderCharIndex)
  scheduleLoaderTick(20)
}

function stopThinkingLoader() {
  clearLoaderTimer()
  animatedThinkingText.value = ''
  loaderCharIndex = 0
  loaderIsDeleting = false
}

const emptyStateLabel = computed(() => {
  return isAnalyticsMode.value
    ? 'Запустите обсуждение кнопкой выше или напишите сообщение в чат'
    : 'Опишите, что нужно создать или изменить на канвасе'
})

const showAnalyticsStartCta = computed(() => {
  if (effectiveTarget.value !== 'analytics') return false
  if (messages.value.length !== 0) return false
  const title = currentFeature.value?.title?.trim()
  return Boolean(title)
})

function startFeatureAnalysis() {
  const featureTitle = currentFeature.value?.title?.trim()
  if (!featureTitle) return
  const productMeta = currentProduct.value as unknown as Record<string, unknown> | null
  const screenMeta = currentScreen.value as unknown as Record<string, unknown> | null
  void handleSubmit(
    buildAnalyticsFeatureAnalysisPrompt({
      projectTitle: currentProduct.value?.title,
      screenTitle: currentScreen.value?.title,
      featureTitle,
      projectDescription:
        typeof productMeta?.description === 'string' ? productMeta.description : undefined,
      screenDescription:
        typeof screenMeta?.description === 'string' ? screenMeta.description : undefined
    })
  )
}

function scrollToBottom() {
  nextTick(() => {
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  })
}

watch(messages, scrollToBottom, { deep: true })
watch(
  isThinking,
  (thinking) => {
    if (thinking) {
      startThinkingLoader()
      return
    }
    stopThinkingLoader()
  },
  { immediate: true }
)
watch(
  () => activeTab.value?.id,
  async () => {
    const nextChat = await ensureChat(effectiveTarget.value, { protoStore: protoStore.value })
    chat.value = nextChat ? markRaw(nextChat) : null
  }
)

async function handleSubmit(text: string) {
  if (status.value === 'streaming' || status.value === 'submitted') return
  try {
    const c = await ensureChat(effectiveTarget.value, { protoStore: protoStore.value })
    if (c) chat.value = markRaw(c)
  } catch (e) {
    console.error('Failed to initialize chat:', e)
    toast.error(e instanceof Error ? e.message : String(e))
    return
  }
  chat.value?.sendMessage({ text }).catch((e: unknown) => {
    console.error('Chat error:', e)
    toast.error(e instanceof Error ? e.message : String(e))
  })
}

function applyDeterministicProtoAssembly(parsed: {
  enterpriseScreenPlan?: Record<string, unknown>
  screenPlan?: { requiredSections?: Array<{ id?: string }> }
  assemblyPlan?: {
    steps?: Array<{
      id?: string
      section?: string
      component_id?: string
      parent_section_id?: string
      parent_step_id?: string
      slot_name?: string
      props?: Record<string, unknown>
    }>
  }
}) {
  const store = protoStore.value
  if (!store) return
  const sectionIds = (parsed.screenPlan?.requiredSections ?? [])
    .map((section) => section.id ?? '')
    .filter(Boolean)
  if (sectionIds.length === 0) return
  const stepNodeMap = new Map<string, string>()
  const steps = parsed.assemblyPlan?.steps ?? []

  // Create top-level section anchors only for steps without explicit parent_step_id.
  for (const step of steps) {
    if (!step.id || !step.section || !step.component_id || step.parent_step_id) continue
    const created = store.addNodeAt(step.component_id, {
      parentId: null,
      index: store.rootNodes.value.length,
      slotName: step.slot_name ?? null
    })
    if (!created) continue
    store.updateProps(created.id, {
      ...(step.props ?? {}),
      __section: step.section
    })
    stepNodeMap.set(step.id, created.id)
  }

  // Attach children for previously unresolved parent_step_id entries.
  for (const step of steps) {
    if (!step.id || !step.section || !step.component_id || !step.parent_step_id) continue
    if (stepNodeMap.has(step.id)) continue
    const parentId = stepNodeMap.get(step.parent_step_id) ?? null
    if (!parentId) continue
    const created = store.addNodeAt(step.component_id, {
      parentId,
      index: store.getChildren(parentId).length,
      slotName: step.slot_name ?? null
    })
    if (!created) continue
    store.updateProps(created.id, {
      ...(step.props ?? {}),
      __section: step.section
    })
    stepNodeMap.set(step.id, created.id)
  }
}

async function handleStop() {
  chat.value?.stop()
  const recreated = await stopAndRecreateChat(effectiveTarget.value, { protoStore: protoStore.value })
  if (recreated) chat.value = markRaw(recreated)
}

async function consumePendingDesignPrompt() {
  const target = effectiveTarget.value
  const key = PENDING_PROMPT_KEY_BY_TARGET[target]
  const raw = localStorage.getItem(key)
  if (!raw) return

  try {
    const parsed = JSON.parse(raw) as {
      text?: string
      target?: CanvasTarget
      mode?: 'auto-scene' | 'code-components'
      uiMode?: 'editor' | 'view'
      resetSession?: boolean
      autoBuildOnly?: boolean
      enterpriseScreenPlan?: Record<string, unknown>
      screenPlan?: { requiredSections?: Array<{ id?: string }> }
      assemblyPlan?: {
        steps?: Array<{
          id?: string
          section?: string
          component_id?: string
          parent_section_id?: string
          parent_step_id?: string
          slot_name?: string
          props?: Record<string, unknown>
        }>
      }
      createdAt?: number
    }
    const ageMs = typeof parsed.createdAt === 'number' ? Date.now() - parsed.createdAt : 0
    const isFresh = ageMs >= 0 && ageMs < 120000
    if (parsed.target !== target || !parsed.text?.trim() || !isFresh) {
      localStorage.removeItem(key)
      return
    }
    if (target === 'proto') {
      if (parsed.resetSession) {
        const scopeKey = getChatScopeKeyForTarget('proto')
        chatSessions.saveMessages(scopeKey, [])
        protoStore.value?.clearAll()
        const recreated = await stopAndRecreateChat('proto', { protoStore: protoStore.value })
        if (recreated) chat.value = markRaw(recreated)
      }
      if (parsed.mode) protoDesignMode.value = parsed.mode
      if (parsed.uiMode && protoStore.value) {
        protoStore.value.mode.value = parsed.uiMode
      } else if (protoStore.value) {
        protoStore.value.mode.value = 'editor'
      }
      if (parsed.autoBuildOnly) {
        applyDeterministicProtoAssembly(parsed)
        localStorage.removeItem(key)
        window.dispatchEvent(new CustomEvent('norka:preview-layout:updated'))
        return
      }
    }
    localStorage.removeItem(key)
    await handleSubmit(parsed.text)
  } catch {
    localStorage.removeItem(key)
  }
}

function handlePendingDesignPromptUpdate() {
  void consumePendingDesignPrompt()
}

onMounted(() => {
  const eventName = PENDING_PROMPT_EVENT_BY_TARGET[effectiveTarget.value]
  window.addEventListener(eventName, handlePendingDesignPromptUpdate)
  void consumePendingDesignPrompt()
})

onUnmounted(() => {
  const eventName = PENDING_PROMPT_EVENT_BY_TARGET[effectiveTarget.value]
  window.removeEventListener(eventName, handlePendingDesignPromptUpdate)
  stopThinkingLoader()
})
</script>

<template>
  <div data-test-id="chat-panel" class="flex min-w-0 flex-1 flex-col overflow-hidden select-text">
    <!-- Provider setup -->
    <ProviderSetup v-if="!isConfigured" />

    <template v-else>
      <ScrollAreaRoot class="min-h-0 flex-1">
        <ScrollAreaViewport class="h-full px-3 py-3 [&>div]:h-full">
          <!-- Empty state: CTA для именованной фичи или подсказка -->
          <div
            v-if="messages.length === 0 && showAnalyticsStartCta"
            data-test-id="chat-analytics-start"
            class="flex h-full flex-col items-center justify-center gap-4 px-4 text-muted"
          >
            <icon-lucide-brain-circuit class="size-9 text-accent opacity-90" />
            <p class="max-w-sm text-center text-xs leading-relaxed text-surface">
              {{ currentFeature?.title }}
            </p>
            <button
              type="button"
              class="rounded-lg border border-accent/40 bg-accent/15 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25"
              @click="startFeatureAnalysis"
            >
              Запустить обсуждение
            </button>
          </div>
          <div
            v-else-if="messages.length === 0"
            data-test-id="chat-empty-state"
            class="flex h-full flex-col items-center justify-center gap-3 text-muted"
          >
            <icon-lucide-message-circle class="size-8 opacity-50" />
            <p class="text-center text-xs">{{ emptyStateLabel }}</p>
          </div>

          <!-- Messages -->
          <div v-else data-test-id="chat-messages" class="flex flex-col gap-3">
            <ChatMessage
              v-for="msg in messages"
              :key="msg.id"
              :message="msg"
              :is-analytics-mode="effectiveTarget === 'analytics'"
              :on-import-structured-analytics="onImportStructuredAnalytics"
              :is-structured-analytics-message-imported="isStructuredAnalyticsMessageImported"
            />

            <!-- Thinking indicator: shown when AI is working but no visible activity -->
            <div v-if="isThinking" data-test-id="chat-typing-indicator" class="flex gap-2">
              <div
                class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/20 text-[10px] font-bold text-muted"
              >
                AI
              </div>
              <div class="flex items-center gap-1 py-2">
                <span class="text-xs text-muted">
                  {{ animatedThinkingText }}
                  <span class="inline-block h-3 w-px animate-pulse bg-muted align-middle" />
                </span>
              </div>
            </div>

            <!-- Continue button when step limit reached -->
            <div v-if="showContinue" class="flex justify-center py-2">
              <button
                class="flex items-center gap-1.5 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                @click="handleSubmit('Continue where you left off')"
              >
                <icon-lucide-play class="size-3" />
                Continue
              </button>
            </div>

            <div ref="messagesEnd" />
          </div>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical" class="flex w-1.5 touch-none p-px select-none">
          <ScrollAreaThumb class="relative flex-1 rounded-full bg-muted/30" />
        </ScrollAreaScrollbar>
      </ScrollAreaRoot>

      <ChatInput
        v-if="!showAnalyticsStartCta"
        :status="status"
        :is-thinking="isThinking"
        @submit="handleSubmit"
        @stop="handleStop"
      />

      <ACPPermissionDialog />
    </template>
  </div>
</template>
