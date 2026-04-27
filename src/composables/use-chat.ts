import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { Chat } from '@ai-sdk/vue'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { useLocalStorage } from '@vueuse/core'
import { DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import { computed, ref, watch } from 'vue'

import SYSTEM_PROMPT from '@/ai/system-prompt.md?raw'
import { createProtoAITools } from '@/ai/proto-tools'
import { MAX_AGENT_STEPS, createAITools, recordStepUsage, resetRunSteps } from '@/ai/tools'
import { useChatSessions } from '@/composables/use-chat-sessions'
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
import type { LanguageModel, UIMessage } from 'ai'
import type { ProtoStore } from '@/composables/use-proto-store'

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
type ChatTarget = 'editor' | 'proto'

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
let stopMessageWatcherProto: (() => void) | null = null

const chatSessions = useChatSessions()

function markTransportDirty() {
  transportDirty = true
  editorChatStore = null
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
let protoChat: Chat<UIMessage> | null = null

const ANTHROPIC_CACHE_CONTROL = {
  anthropic: { cacheControl: { type: 'ephemeral' } }
} as const

const LM_STUDIO_CANVAS_PROMPT = `
You are a design assistant inside a live design canvas.
You MUST build layouts by calling tools, not by describing steps only.

Canvas protocol:
1) Call get_components() to discover available library components
2) Create a frame with render(...)
3) Place PrimeReact components with create_instance({ component_id, x, y })
4) Refine spacing/alignment with set_layout / batch_update
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

function createProtoTransport(protoStore: ProtoStore) {
  const cacheProviderOptions = supportsAnthropicCaching() ? ANTHROPIC_CACHE_CONTROL : undefined
  const isLMStudio = providerID.value === 'lm-studio'
  const effectiveMaxOutputTokens = isLMStudio ? undefined : maxOutputTokens.value
  const protoInstructions = [
    EXECUTION_FIRST_CANVAS_PREFIX,
    'You are editing the PrimeReact proto canvas.',
    'Always execute tools to make concrete changes.',
    'You and the user are co-editing the same canvas state in real time.',
    'Call get_components first, then create_instance / set_props / remove_node / move_node / move_before / move_after / move_inside as needed.',
    'When user asks to modify selected element, call get_selection first and operate on that node.',
    'After each mutation, call describe to verify the result exists on canvas.',
  ].join('\n\n')

  const agent = new ToolLoopAgent({
    model: createModel(),
    instructions: protoInstructions,
    tools: createProtoAITools(protoStore),
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    maxOutputTokens: effectiveMaxOutputTokens,
    providerOptions: cacheProviderOptions,
    prepareCall: (options) => ({
      ...options,
      maxOutputTokens: effectiveMaxOutputTokens,
      providerOptions: cacheProviderOptions,
    }),
  })

  return new DirectChatTransport({ agent })
}

async function ensureChat(
  target: ChatTarget = 'editor',
  options?: { protoStore?: ProtoStore }
): Promise<Chat<UIMessage> | null> {
  if (!isConfigured.value) return null

  const isEditorTarget = target === 'editor'
  const store = isEditorTarget ? getActiveEditorStore() : null
  const current = isEditorTarget ? editorChat : protoChat
  const needsRecreate = isEditorTarget
    ? !current || transportDirty || editorChatStore !== store
    : !current || transportDirty

  if (needsRecreate) {
    if (isEditorTarget) {
      stopMessageWatcherEditor?.()
      stopMessageWatcherEditor = null
    } else {
      stopMessageWatcherProto?.()
      stopMessageWatcherProto = null
    }
    const messages = chatSessions.getMessages(chatSessions.activeSessionId.value)
    let transport: DirectChatTransport | Awaited<ReturnType<typeof createACPTransport>>
    if (isACPProvider.value) {
      transport = await createACPTransport()
    } else if (!isEditorTarget) {
      if (!options?.protoStore) {
        throw new Error('Proto chat requires proto store')
      }
      transport = createProtoTransport(options.protoStore)
    } else {
      const activeStore = getActiveEditorStore()
      transport = createTransport(activeStore)
      editorChatStore = activeStore
    }
    const nextChat = new Chat<UIMessage>({ transport, messages })
    if (isEditorTarget) {
      editorChat = nextChat
    } else {
      protoChat = nextChat
    }
    transportDirty = false

    const savedChat = nextChat
    const stop = watch(
      () => savedChat.messages,
      (msgs) => chatSessions.saveMessages(chatSessions.activeSessionId.value, msgs),
      { deep: true }
    )
    if (isEditorTarget) {
      stopMessageWatcherEditor = stop
    } else {
      stopMessageWatcherProto = stop
    }
  }
  return isEditorTarget ? editorChat : protoChat
}

function resetChat() {
  stopMessageWatcherEditor?.()
  stopMessageWatcherEditor = null
  stopMessageWatcherProto?.()
  stopMessageWatcherProto = null
  chatSessions.saveMessages(chatSessions.activeSessionId.value, [])
  editorChat = null
  protoChat = null
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
    resetChat,
    chatSessions
  }
}
