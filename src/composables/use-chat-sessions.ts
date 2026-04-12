import { computed, ref, watch } from 'vue'

import type { UIMessage } from 'ai'

export interface ChatSession {
  id: string
  name: string
  createdAt: number
  providerID: string
  messages: UIMessage[]
}

const STORAGE_KEY = 'beresta:chat-sessions'
const ACTIVE_KEY = 'beresta:active-session-id'

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ChatSession[]) : []
  } catch {
    return []
  }
}

function persist(list: ChatSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

// Singleton state
const sessions = ref<ChatSession[]>(loadSessions())
const activeSessionId = ref<string>(localStorage.getItem(ACTIVE_KEY) ?? '')

// Module-level createSession so it's available before useChatSessions() is called
function createSession(providerID: string): ChatSession {
  const id = crypto.randomUUID().slice(0, 8)
  const index = sessions.value.length + 1
  const session: ChatSession = {
    id,
    name: `Сессия ${index}`,
    createdAt: Date.now(),
    providerID,
    messages: []
  }
  sessions.value = [...sessions.value, session]
  persist(sessions.value)
  activeSessionId.value = id
  return session
}

function renameSession(id: string, name: string) {
  sessions.value = sessions.value.map((s) => (s.id === id ? { ...s, name } : s))
  persist(sessions.value)
}

function deleteSession(id: string) {
  const idx = sessions.value.findIndex((s) => s.id === id)
  if (idx === -1) return
  sessions.value = sessions.value.filter((s) => s.id !== id)
  persist(sessions.value)
  if (activeSessionId.value === id) {
    if (sessions.value.length > 0) {
      activeSessionId.value = sessions.value[Math.max(0, idx - 1)].id
    } else {
      createSession('openrouter')
    }
  }
}

function setActiveSession(id: string) {
  if (sessions.value.find((s) => s.id === id)) {
    activeSessionId.value = id
  }
}

function getMessages(id: string): UIMessage[] {
  return sessions.value.find((s) => s.id === id)?.messages ?? []
}

function saveMessages(id: string, messages: UIMessage[]) {
  sessions.value = sessions.value.map((s) => (s.id === id ? { ...s, messages } : s))
  persist(sessions.value)
}

// Ensure there's always an active session
function ensureActive() {
  if (sessions.value.length === 0 || !sessions.value.find((s) => s.id === activeSessionId.value)) {
    if (sessions.value.length > 0) {
      activeSessionId.value = sessions.value[sessions.value.length - 1].id
    } else {
      createSession('openrouter')
    }
  }
}

watch(activeSessionId, (id) => {
  localStorage.setItem(ACTIVE_KEY, id)
})

ensureActive()

export function useChatSessions() {
  const activeSession = computed<ChatSession | null>(
    () => sessions.value.find((s) => s.id === activeSessionId.value) ?? null
  )

  return {
    sessions,
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
