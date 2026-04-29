import { computed, ref } from 'vue'

import type { UIMessage } from 'ai'

const STORAGE_KEY = 'norka:chat-messages-by-scope'
const LEGACY_SESSIONS_KEY = 'norka:chat-sessions'
const ACTIVE_KEY = 'norka:active-session-id'
const SINGLE_SESSION_ID = 'default'
const DEFAULT_SCOPE = 'editor:global'

type ScopeMessages = Record<string, UIMessage[]>

function isScopeMessages(value: unknown): value is ScopeMessages {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function migrateLegacySessions(): ScopeMessages {
  try {
    const existingRaw = localStorage.getItem(STORAGE_KEY)
    if (existingRaw) {
      const parsed = JSON.parse(existingRaw) as unknown
      if (isScopeMessages(parsed)) {
        return parsed
      }
    }
  } catch (error) {
    console.warn('Failed to read scoped chat storage, trying legacy format.', error)
  }

  try {
    const legacyRaw = localStorage.getItem(LEGACY_SESSIONS_KEY)
    const parsed = legacyRaw ? (JSON.parse(legacyRaw) as Array<{ messages?: UIMessage[] }>) : []
    const first = parsed[0]?.messages ?? []
    const migrated: ScopeMessages = { [DEFAULT_SCOPE]: first }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
    localStorage.removeItem(LEGACY_SESSIONS_KEY)
    return migrated
  } catch {
    return { [DEFAULT_SCOPE]: [] }
  }
}

function persist(messagesByScope: ScopeMessages) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesByScope))
}

const scopedMessages = ref<ScopeMessages>(migrateLegacySessions())
const activeSessionId = ref<string>(SINGLE_SESSION_ID)

function createSession(_providerID: string) {
  activeSessionId.value = SINGLE_SESSION_ID
  localStorage.setItem(ACTIVE_KEY, SINGLE_SESSION_ID)
}

function renameSession(_id: string, _name: string) {
  // Single-session mode keeps a fixed display name.
}

function deleteSession(id: string) {
  if (id !== SINGLE_SESSION_ID) return
  scopedMessages.value = { [DEFAULT_SCOPE]: [] }
  persist(scopedMessages.value)
  activeSessionId.value = SINGLE_SESSION_ID
  localStorage.setItem(ACTIVE_KEY, SINGLE_SESSION_ID)
}

function setActiveSession(id: string) {
  if (id !== SINGLE_SESSION_ID) return
  activeSessionId.value = SINGLE_SESSION_ID
  localStorage.setItem(ACTIVE_KEY, SINGLE_SESSION_ID)
}

function getMessages(scopeKey: string): UIMessage[] {
  return scopedMessages.value[scopeKey] ?? []
}

function saveMessages(scopeKey: string, messages: UIMessage[]) {
  scopedMessages.value = { ...scopedMessages.value, [scopeKey]: messages }
  persist(scopedMessages.value)
}

function ensureActive() {
  if (!scopedMessages.value[DEFAULT_SCOPE]) {
    scopedMessages.value = { ...scopedMessages.value, [DEFAULT_SCOPE]: [] }
    persist(scopedMessages.value)
  }
  activeSessionId.value = SINGLE_SESSION_ID
  localStorage.setItem(ACTIVE_KEY, SINGLE_SESSION_ID)
}

ensureActive()

export function useChatSessions() {
  const activeSession = computed(() => ({
    id: SINGLE_SESSION_ID,
    name: 'Чат',
    messages: getMessages(DEFAULT_SCOPE)
  }))

  return {
    sessions: computed(() => [activeSession.value]),
    activeSessionId,
    activeSession,
    createSession,
    renameSession,
    deleteSession,
    setActiveSession,
    getMessages,
    saveMessages
  }
}
