import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { Chat } from '@ai-sdk/vue'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { useLocalStorage } from '@vueuse/core'
import { DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import { computed, ref, watch } from 'vue'

import SYSTEM_PROMPT from '@/ai/system-prompt.md?raw'
import { MAX_AGENT_STEPS, createAITools, recordStepUsage, resetRunSteps } from '@/ai/tools'
import { useChatSessions } from '@/composables/use-chat-sessions'
import { useProjects } from '@/composables/use-projects'
import { getActiveEditorStore } from '@/stores/editor'
import {
  ACP_AGENTS,
  AI_PROVIDERS,
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
  IS_BROWSER,
  IS_TAURI,
  setPexelsApiKey,
  setUnsplashAccessKey
} from '@norka/core'

import type { ACPAgentID, AIProviderID } from '@norka/core'
import type { ChatTransport, LanguageModel, UIMessage } from 'ai'

const STORAGE_PREFIX = 'norka:'
const LEGACY_KEY_STORAGE = `${STORAGE_PREFIX}openrouter-api-key`

function keyStorageKey(id: string) {
  return `${STORAGE_PREFIX}ai-key:${id}`
}

function migrateLegacyStorage() {
  const legacyKey = localStorage.getItem(LEGACY_KEY_STORAGE)
  if (legacyKey) {
    localStorage.setItem(keyStorageKey('openrouter'), legacyKey)
    localStorage.removeItem(LEGACY_KEY_STORAGE)
    if (!localStorage.getItem(`${STORAGE_PREFIX}ai-provider`)) {
      localStorage.setItem(`${STORAGE_PREFIX}ai-provider`, 'openrouter')
    }
  }
}

if (IS_BROWSER) migrateLegacyStorage()

const providerID = useLocalStorage<AIProviderID>(
  `${STORAGE_PREFIX}ai-provider`,
  DEFAULT_AI_PROVIDER
)
const apiKeyStorageKey = computed(() => keyStorageKey(providerID.value))
const apiKey = useLocalStorage(apiKeyStorageKey, '')
const modelID = useLocalStorage(`${STORAGE_PREFIX}ai-model`, DEFAULT_AI_MODEL)
const customBaseURL = useLocalStorage(`${STORAGE_PREFIX}ai-base-url`, '')
const customModelID = useLocalStorage(`${STORAGE_PREFIX}ai-custom-model`, '')
const customAPIType = useLocalStorage<'completions' | 'responses'>(
  `${STORAGE_PREFIX}ai-api-type`,
  'completions'
)
const maxOutputTokens = useLocalStorage(`${STORAGE_PREFIX}ai-max-output-tokens`, 16384)
const pexelsApiKey = useLocalStorage(`${STORAGE_PREFIX}pexels-api-key`, '')
const unsplashAccessKey = useLocalStorage(`${STORAGE_PREFIX}unsplash-access-key`, '')
const activeTab = ref<'design' | 'code' | 'ai' | 'lint' | 'snapshots'>('design')
type ChatTarget = 'editor' | 'analytics'

const providerDef = computed(
  () => AI_PROVIDERS.find((p) => p.id === providerID.value) ?? AI_PROVIDERS[0]
)

const isACPProvider = computed(() => providerID.value.startsWith('acp:'))

// Tracks which ACP provider IDs have been successfully set up
const acpReadyIds = useLocalStorage<string[]>(`${STORAGE_PREFIX}acp-ready`, [])

const isConfigured = computed(() => {
  if (isACPProvider.value) return IS_TAURI && acpReadyIds.value.includes(providerID.value)
  if (providerID.value === 'lm-studio') return !!customModelID.value
  if (!apiKey.value) return false
  const needsBaseURL =
    providerID.value === 'openai-compatible' || providerID.value === 'anthropic-compatible'
  if (needsBaseURL && !customBaseURL.value) return false
  return true
})

function markACPReady(id: string) {
  if (!acpReadyIds.value.includes(id)) {
    acpReadyIds.value = [...acpReadyIds.value, id]
  }
}

let transportDirty = false
let editorChatStore: ReturnType<typeof getActiveEditorStore> | null = null
let stopMessageWatcherEditor: (() => void) | null = null
let stopMessageWatcherAnalytics: (() => void) | null = null

const chatSessions = useChatSessions()
const { context } = useProjects()

function markTransportDirty() {
  transportDirty = true
  editorChatStore = null
}

function getChatScopeKey(target: ChatTarget): string {
  if (!context.value) return `${target}:global`
  const { productId, screenId, featureId } = context.value
  return `${target}:${productId}:${screenId}:${featureId}`
}

watch(
  pexelsApiKey,
  (key) => {
    setPexelsApiKey(key || null)
  },
  { immediate: true }
)

watch(
  unsplashAccessKey,
  (key) => {
    setUnsplashAccessKey(key || null)
  },
  { immediate: true }
)

watch(providerID, (id) => {
  const def = AI_PROVIDERS.find((p) => p.id === id)
  if (def?.defaultModel) {
    modelID.value = def.defaultModel
  }
  markTransportDirty()
})

watch(modelID, markTransportDirty)
watch(customModelID, markTransportDirty)
watch(customAPIType, markTransportDirty)
watch(apiKey, markTransportDirty)
watch(customBaseURL, markTransportDirty)
watch(chatSessions.activeSessionId, markTransportDirty)
watch(context, markTransportDirty, { deep: true })

function setAPIKey(key: string) {
  apiKey.value = key
}

function createModel(): LanguageModel {
  const key = apiKey.value
  const needsCustomModel =
    providerID.value === 'openai-compatible' ||
    providerID.value === 'anthropic-compatible' ||
    providerID.value === 'lm-studio'
  const effectiveModelID = needsCustomModel ? customModelID.value : modelID.value

  switch (providerID.value) {
    case 'openrouter': {
      const openrouter = createOpenRouter({
        apiKey: key,
        headers: {
          'X-OpenRouter-Title': 'Nork',
          'HTTP-Referer': 'https://github.com/norka/norka'
        }
      })
      return openrouter(effectiveModelID)
    }
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey: key })
      return anthropic(effectiveModelID)
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey: key })
      return openai(effectiveModelID)
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey: key })
      return google(effectiveModelID)
    }
    case 'zai': {
      const zai = createAnthropic({
        apiKey: key,
        baseURL: 'https://api.z.ai/api/anthropic'
      })
      return zai(effectiveModelID)
    }
    case 'minimax': {
      const minimax = createOpenAI({
        apiKey: key,
        baseURL: 'https://api.minimax.io/v1'
      })
      return minimax.chat(effectiveModelID)
    }
    case 'openai-compatible': {
      const custom = createOpenAI({
        apiKey: key,
        baseURL: customBaseURL.value
      })
      return customAPIType.value === 'responses'
        ? custom.responses(effectiveModelID)
        : custom.chat(effectiveModelID)
    }
    case 'anthropic-compatible': {
      const custom = createAnthropic({
        apiKey: key,
        baseURL: customBaseURL.value
      })
      return custom(effectiveModelID)
    }
    case 'lm-studio': {
      const lmstudio = createOpenAI({ apiKey: 'lm-studio', baseURL: 'http://localhost:1234/v1' })
      return lmstudio.chat(effectiveModelID)
    }
    default: {
      if (providerID.value.startsWith('acp:')) {
        throw new Error('ACP providers do not use direct API models')
      }
      throw new Error(`Unknown provider: ${providerID.value}`)
    }
  }
}

export { createModel }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only mock transports don't implement full generics
let overrideTransport: (() => any) | null = null
let editorChat: Chat<UIMessage> | null = null
let analyticsChat: Chat<UIMessage> | null = null
let editorScopeKey = ''
let analyticsScopeKey = ''

const ANTHROPIC_CACHE_CONTROL = {
  anthropic: { cacheControl: { type: 'ephemeral' } }
} as const

const LM_STUDIO_CANVAS_PROMPT = `
You are a design assistant inside a live design canvas.
You MUST build layouts by calling tools, not by describing steps only.

Canvas protocol:
1) Call get_components() to discover available library components
2) Create structure with create_instance(...) and tree operations (move_node / move_before / move_after / move_inside)
3) Refine props with set_props(...)
4) Validate structure with describe(...) before final response
5) Call describe(...) to verify result and fix issues

Rules:
- If user asks to create a mockup, immediately execute tool calls.
- Keep explanations short and prioritize concrete canvas changes.
- If a tool fails, retry with corrected arguments and continue.
`.trim()

const EXECUTION_FIRST_CANVAS_PREFIX = `
Execution-first rule:
- If the user asks to build/create/assemble/draw a mockup, start tool execution immediately.
- Do not ask discovery questions first unless the user explicitly asks for analysis.
- Produce at least one concrete canvas mutation in the first tool step.
`.trim()

function supportsAnthropicCaching(): boolean {
  return (
    providerID.value === 'anthropic' ||
    providerID.value === 'anthropic-compatible' ||
    (providerID.value === 'openrouter' && modelID.value.startsWith('anthropic/'))
  )
}

let acpTransportInstance: { destroy(): Promise<void> } | null = null

async function createACPTransport() {
  const agentId = providerID.value.replace('acp:', '') as ACPAgentID
  const agentDef = ACP_AGENTS.find((a) => a.id === agentId)
  if (!agentDef) throw new Error(`Unknown ACP agent: ${agentId}`)

  const { ACPChatTransport } = await import('@/ai/acp-transport')
  const { homeDir } = await import('@tauri-apps/api/path')
  await acpTransportInstance?.destroy()
  const transport = new ACPChatTransport({ agentDef, cwd: await homeDir() })
  acpTransportInstance = transport
  return transport
}

function createTransport(store: ReturnType<typeof getActiveEditorStore>) {
  if (overrideTransport) return overrideTransport()

  void acpTransportInstance?.destroy()
  acpTransportInstance = null

  const cacheProviderOptions = supportsAnthropicCaching() ? ANTHROPIC_CACHE_CONTROL : undefined

  const isLMStudio = providerID.value === 'lm-studio'
  // LM Studio must keep tool access enabled, otherwise it cannot control canvas.
  // Use a compact system prompt to fit smaller local context windows.
  const tools = createAITools(store)
  const effectiveMaxOutputTokens = isLMStudio ? undefined : maxOutputTokens.value
  const effectiveInstructions = isLMStudio
    ? `${EXECUTION_FIRST_CANVAS_PREFIX}\n\n${LM_STUDIO_CANVAS_PROMPT}`
    : `${EXECUTION_FIRST_CANVAS_PREFIX}\n\n${SYSTEM_PROMPT}`

  const agent = new ToolLoopAgent({
    model: createModel(),
    instructions: effectiveInstructions,
    tools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    maxOutputTokens: effectiveMaxOutputTokens,
    providerOptions: cacheProviderOptions,
    prepareCall: (options) => {
      resetRunSteps(store)
      return {
        ...options,
        maxOutputTokens: effectiveMaxOutputTokens,
        providerOptions: cacheProviderOptions
      }
    },
    onStepFinish: ({ usage }) => {
      recordStepUsage(
        {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          cacheReadTokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
          cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens ?? 0,
          timestamp: Date.now()
        },
        store
      )
    }
  })

  return new DirectChatTransport({ agent })
}

function createAnalyticsTransport() {
  const isLMStudio = providerID.value === 'lm-studio'
  const effectiveMaxOutputTokens = isLMStudio ? undefined : Math.min(maxOutputTokens.value, 4096)
  const instructions = [
    'Ты — продуктовый аналитик и UX-исследователь.',
    'Помогай формировать аналитический бриф для фичи: задача, пользователь, сценарии, состояния, ограничения, метрики и открытые вопросы.',
    'Работай по разделам строго в порядке: task -> users -> scenarios -> states -> constraints -> metrics -> questions.',
    'Не перескакивай между разделами, пока в текущем разделе нет достаточной конкретики.',
    'Всегда отвечай только на русском языке.',
    'Возвращай строго один JSON-объект без markdown и без текста до/после JSON.',
    'Строгая схема JSON: {"section":"task|users|scenarios|states|constraints|metrics|questions","answer":"...","nextQuestion":"...","readyToSave":true|false}.',
    'section — только один активный раздел для текущего шага.',
    'Ключевая привязка: section всегда должен соответствовать последнему заданному пользователю вопросу и активному разделу.',
    'Если пользователь отвечает коротко или неопределённо (например: «предложи сам», «сам предложи», «на твой выбор», «как считаешь»), не перескакивай в другой раздел и не смешивай секции.',
    'Для таких ответов: сохраняй текущий section; если можно безопасно предложить реалистичный рабочий вариант внутри текущего раздела — верни его в answer и readyToSave=true; если уверенности недостаточно — readyToSave=false и задай один уточняющий вопрос в рамках того же section.',
    'Никогда не заполняй constraints/metrics/questions, если текущий вопрос был про task/users/scenarios/states, и наоборот.',
    'answer — только подтверждённый факт для записи в analytics.md, без предположений.',
    'Если факт подтверждён, ставь readyToSave=true и заполняй answer.',
    'Если данных недостаточно, ставь readyToSave=false, answer делай пустой строкой и задай ровно один следующий вопрос в nextQuestion.',
    'Не добавляй никаких дополнительных ключей.',
    'Не генерируй код и не управляй канвасом — только аналитический контент.',
    'Не делай финальную сводку без явной просьбы пользователя.'
  ].join('\n')

  const agent = new ToolLoopAgent({
    model: createModel(),
    instructions,
    stopWhen: stepCountIs(12),
    maxOutputTokens: effectiveMaxOutputTokens
  })

  return new DirectChatTransport({ agent }) as unknown as ChatTransport<UIMessage>
}

interface TargetState {
  isEditorTarget: boolean
  store: ReturnType<typeof getActiveEditorStore> | null
  currentChat: Chat<UIMessage> | null
  currentScopeKey: string
}

function getTargetState(target: ChatTarget): TargetState {
  const isEditorTarget = target === 'editor'
  const store = isEditorTarget ? getActiveEditorStore() : null
  let currentChat = analyticsChat
  let currentScopeKey = analyticsScopeKey
  if (isEditorTarget) {
    currentChat = editorChat
    currentScopeKey = editorScopeKey
  }
  return { isEditorTarget, store, currentChat, currentScopeKey }
}

function clearTargetWatcher(state: TargetState) {
  if (state.isEditorTarget) {
    stopMessageWatcherEditor?.()
    stopMessageWatcherEditor = null
    return
  }
  stopMessageWatcherAnalytics?.()
  stopMessageWatcherAnalytics = null
}

async function createTargetTransport(
  state: TargetState
): Promise<ChatTransport<UIMessage>> {
  if (isACPProvider.value) {
    return await createACPTransport()
  }
  const activeStore = getActiveEditorStore()
  if (state.isEditorTarget) {
    editorChatStore = activeStore
    return createTransport(activeStore)
  }
  return createAnalyticsTransport()
}

function assignTargetChat(state: TargetState, chat: Chat<UIMessage>, scopeKey: string) {
  if (state.isEditorTarget) {
    editorChat = chat
    editorScopeKey = scopeKey
    return
  }
  analyticsChat = chat
  analyticsScopeKey = scopeKey
}

function assignTargetWatcher(state: TargetState, stop: () => void) {
  if (state.isEditorTarget) {
    stopMessageWatcherEditor = stop
    return
  }
  stopMessageWatcherAnalytics = stop
}

async function ensureChat(
  target: ChatTarget = 'editor'
): Promise<Chat<UIMessage> | null> {
  if (!isConfigured.value) return null

  const state = getTargetState(target)
  const scopeKey = getChatScopeKey(target)
  const needsRecreate = state.isEditorTarget
    ? !state.currentChat ||
      transportDirty ||
      editorChatStore !== state.store ||
      state.currentScopeKey !== scopeKey
    : !state.currentChat || transportDirty || state.currentScopeKey !== scopeKey

  if (needsRecreate) {
    clearTargetWatcher(state)
    const messages = chatSessions.getMessages(scopeKey)
    const transport = await createTargetTransport(state)
    const nextChat = new Chat<UIMessage>({ transport, messages })
    assignTargetChat(state, nextChat, scopeKey)
    transportDirty = false

    const savedChat = nextChat
    const savedScope = scopeKey
    const stop = watch(
      () => savedChat.messages,
      (msgs) => chatSessions.saveMessages(savedScope, msgs),
      { deep: true }
    )
    assignTargetWatcher(state, stop)
  }
  if (state.isEditorTarget) return editorChat
  return analyticsChat
}

async function stopAndRecreateChat(target: ChatTarget = 'editor'): Promise<Chat<UIMessage> | null> {
  const state = getTargetState(target)
  state.currentChat?.stop()
  markTransportDirty()
  return ensureChat(target)
}

function resetChat() {
  stopMessageWatcherEditor?.()
  stopMessageWatcherEditor = null
  stopMessageWatcherAnalytics?.()
  stopMessageWatcherAnalytics = null
  chatSessions.saveMessages(editorScopeKey || 'editor:global', [])
  chatSessions.saveMessages(analyticsScopeKey || 'analytics:global', [])
  editorChat = null
  analyticsChat = null
  editorScopeKey = ''
  analyticsScopeKey = ''
  editorChatStore = null
  transportDirty = false
}

if (IS_BROWSER) {
  window.__NORKA_SET_TRANSPORT__ = (factory) => {
    overrideTransport = factory
  }
}

export function useAIChat() {
  return {
    providerID,
    providerDef,
    apiKey,
    setAPIKey,
    modelID,
    customBaseURL,
    customModelID,
    customAPIType,
    maxOutputTokens,
    pexelsApiKey,
    unsplashAccessKey,
    activeTab,
    isConfigured,
    markACPReady,
    ensureChat,
    getChatScopeKeyForTarget: getChatScopeKey,
    stopAndRecreateChat,
    resetChat,
    chatSessions
  }
}
